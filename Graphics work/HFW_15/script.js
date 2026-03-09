const img = document.getElementById("streetImage");

function applyFilter(type){

  if(type === "grayscale"){
    img.style.filter = "grayscale(100%)";
  }

  if(type === "neon"){
    img.style.filter = "invert(1) hue-rotate(280deg) saturate(5)";
  }

  if(type === "invert"){
    img.style.filter = "invert(1)";
  }

  if(type === "blur"){
    img.style.filter = "blur(4px)";
  }

  if(type === "reset"){
    img.style.filter = "none";
  }

}