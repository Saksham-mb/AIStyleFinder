import os
import json
from fastapi import FastAPI, UploadFile, File, HTTPException, status, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from serpapi import GoogleSearch
from dotenv import load_dotenv
from database import create_db_and_tables, engine
from models import User, OutfitScan
from sqlmodel import Session, select, desc
import re # For cleaning the price strings
import firebase_admin
from firebase_admin import credentials, auth
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import cloudinary
import cloudinary.uploader
from typing import Optional

# Initialize the Firebase Vault using your hidden JSON file
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-credentials.json")
    firebase_admin.initialize_app(cred)

# This tells FastAPI to expect a "Bearer Token" in the request headers
security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        # auth.verify_id_token physically talks to Google to check the signature
        token = credentials.credentials
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")

        with Session(engine) as session:
            # Check if this user is already in our local database
            existing_user = session.get(User, uid)
            # If they don't exist, this is their first API call. Add them!
            if not existing_user:
                new_user = User(
                    id=uid, 
                    email=email
                )
                session.add(new_user)
                session.commit()
        return decoded_token # This contains the user's email, uid, etc.
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

MAX_MB = 5
MAX_FILE_SIZE = MAX_MB * 1024 * 1024
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"]


load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SERPAPI_API_KEY = os.getenv("SERPAPI_API_KEY")
cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET"),
  secure = True
)

app = FastAPI()

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash-lite')

# 2. Data Validation: Force React to send data in this exact structure
class SearchRequest(BaseModel):
    items: list[str]
    image_url: str


#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

@app.post("/api/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    user_token: dict = Depends(verify_firebase_token)
    ):
    print(f"Verified Request from user: {user_token.get('email')}")
    # 1. The MIME Type Check (Reject non-images instantly)
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid file type. Only JPEG, PNG, and WEBP are permitted."
        )
    
    # 2. The RAM Crash Protection (Read slightly more than max size)
    # If the file is 2GB, we ONLY read the first 5MB to check the size, preventing a crash.
    file_bytes = await file.read(MAX_FILE_SIZE + 1)
    
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, 
            detail=f"Payload too large. Maximum file size is {MAX_MB}MB."
        )
    
    # 3. Reset the file cursor so Gemini can read the valid image properly
    await file.seek(0)

    image_bytes = await file.read()
    image_parts = [{"mime_type": file.content_type, "data": image_bytes}]

    try:
        # We put it in a specific folder so your Cloudinary dashboard stays clean
        upload_result = cloudinary.uploader.upload(image_bytes, folder="style_finder_scans")
        secure_image_url = upload_result.get("secure_url")
    except Exception as e:
        print(f"Cloudinary Upload Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image to CDN")
    
    prompt = """
    You are an expert Indian fashion stylist. Analyze this outfit.
    Return a strict JSON array of strings containing the 1 to 4 main clothing items visible.
    Focus on material, cut, and color. 
    Example output: ["Navy Blue Cotton Polo", "Light Wash Baggy Denim Jeans", "White Canvas Sneakers"]
    Do not use markdown formatting like ```json. Just return the raw array.
    """
    
    try:
        response = model.generate_content([prompt, image_parts[0]])
        clean_text = response.text.strip().strip('`').replace('json\n', '')
        items = json.loads(clean_text)
        return {"items": items, "imageUrl":secure_image_url}
    except Exception as e:
        print(f"Gemini Error: {e}")
        return {"items": ["Error detecting items."],"imageUrl": None}



#~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

@app.post("/api/search-dupes")
def search_dupes(request: SearchRequest, user_token: dict = Depends(verify_firebase_token)):
    final_results = []

    # Helper function to strip "₹" and commas so Pandas can do math later
    def clean_price_string(price_str):
        if not price_str: return 0
        digits = re.sub(r'[^\d]', '', str(price_str))
        return int(digits) if digits else 0

    # 2. Loop through Gemini's items
    for item in request.items:
        params = {
            "engine": "google_shopping",
            "q": f"{item} india online",
            "hl": "en",
            "gl": "in",
            "api_key": SERPAPI_API_KEY
        }
        
        try:
            search = GoogleSearch(params)
            results = search.get_dict()
            shopping_results = results.get("shopping_results", [])
        
            if not shopping_results:
                continue

            sorted_by_price = sorted(shopping_results, key=lambda x: x.get("extracted_price", 0))
            budget_dupe = sorted_by_price[0]
            premium_match = sorted_by_price[-1] if len(sorted_by_price) > 1 else sorted_by_price[0]

            # 2. Build the exact JSON format your React Frontend expects
            final_results.append({
                "detectedItem": item,
                "results": [
                    {
                        "type": "Premium Match",
                        "brand": premium_match.get("source", "Unknown"),
                        "price": premium_match.get("price", "N/A"),
                        "url": premium_match.get("link", "#")
                    },
                    {
                        "type": "Budget Dupe",
                        "brand": budget_dupe.get("source", "Unknown"),
                        "price": budget_dupe.get("price", "N/A"),
                        "url": budget_dupe.get("link", "#")
                    }
                ]
            })
        except Exception as e:
            print(f"SerpApi Error for {item}: {e}")
        
    # 3. The Transaction: Save everything to the new OutfitScan table
    # Make sure your route definition includes `user_token: dict = Depends(verify_firebase_token)`
    with Session(engine) as session:
        new_scan = OutfitScan(
            user_id=user_token.get("uid"), 
            image_url=request.image_url, # We will upgrade this to a cloud URL soon
            analysis_payload=json.dumps(final_results) # The massive JSON string dump
            )
        session.add(new_scan)
        session.commit()
        
    return final_results


@app.get("/api/wardrobe")
async def get_wardrobe(
    limit: Optional[int] = None,
    user_token: dict = Depends(verify_firebase_token) # <-- The lock
):
    with Session(engine) as session:
        # 1. Query the database ONLY for rows matching this exact user's UID
        # We order it by scanned_at descending, so the newest scans appear first
        statement = select(OutfitScan).where(OutfitScan.user_id == user_token.get("uid")).order_by(desc(OutfitScan.scanned_at))
        if limit:
            statement = statement.limit(limit)
        # Execute the search
        user_scans = session.exec(statement).all()
        
        # 2. Re-format the data for React
        formatted_wardrobe = []
        for scan in user_scans:
            formatted_wardrobe.append({
                "scan_id": scan.id,
                "image_url": scan.image_url,
                "scanned_at": scan.scanned_at,
                # We stored this as a string, so we must unpack it back into a JSON object 
                # before sending it across the network to React
                "analysis_payload": json.loads(scan.analysis_payload) 
            })
            
        return formatted_wardrobe