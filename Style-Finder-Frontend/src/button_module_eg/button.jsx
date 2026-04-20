import buttonstyle from './button.module.css';

function Button() {
    let count=0;
    const handleClick=(e,name)=>{count++;console.log(e);e.target.textContent = `${name} clicked me ${count} times`};
    return(
    <button onClick={(e)=>handleClick(e,"Ghost")} className={buttonstyle.button}>Click me</button>
    );
}

export default Button;