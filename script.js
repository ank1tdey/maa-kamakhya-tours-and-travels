(function(){
var $=function(s){return document.querySelector(s)};
var BUSINESS_WA="916295594881";
document.querySelectorAll("[data-rating]").forEach(function(e){e.textContent=e.closest(".rev")?"4.9 / 5":"4.9/5"});
$("#year").textContent=new Date().getFullYear();

// Mobile menu
var burger=$("#burger"),menu=$("#menu");
function setMenu(o){menu.classList.toggle("open",o);burger.setAttribute("aria-expanded",o);burger.setAttribute("aria-label",o?"Close menu":"Open menu")}
burger.addEventListener("click",function(){setMenu(!menu.classList.contains("open"))});
menu.addEventListener("click",function(e){if(e.target.tagName==="A")setMenu(false)});

// Image fallbacks
function missing(img){var f=img.closest(".ph");if(f)f.classList.add("missing");var g=img.closest(".gi");if(g){g.hidden=true;checkGal()}}
function checkGal(){var any=[].some.call(document.querySelectorAll(".gi"),function(g){return !g.hidden});$("#galEmpty").hidden=any}
document.querySelectorAll("img").forEach(function(img){
 if(img.complete&&img.naturalWidth===0&&img.getAttribute("src"))missing(img);
 img.addEventListener("error",function(){missing(img)});
});

// Form
var form=$("#rideForm"),date=$("#date");
function today(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
date.min=today();
function fail(id,msg){var el=$("#"+id);$("#e-"+id).textContent=msg;el.setAttribute("aria-invalid",!!msg);return !msg}
function preset(sel,val){var s=$(sel);for(var i=0;i<s.options.length;i++)if(s.options[i].text===val)s.selectedIndex=i;$("#book").scrollIntoView();setTimeout(function(){$("#pickup").focus({preventScroll:true})},400)}
document.querySelectorAll("[data-type]").forEach(function(b){b.addEventListener("click",function(){preset("#type",b.dataset.type)})});
document.querySelectorAll("[data-vehicle]").forEach(function(b){b.addEventListener("click",function(){preset("#vehicle",b.dataset.vehicle)})});
form.addEventListener("submit",function(e){
 e.preventDefault();
 var p=$("#pickup").value.trim(),d=$("#dest").value.trim(),dt=date.value;
 var ok=[fail("pickup",p?"":"Enter your pickup location."),fail("dest",d?"":"Enter your destination."),
  fail("date",!dt?"Choose your travel date.":(dt<today()?"Travel date can't be in the past.":""))].every(Boolean);
 if(!ok){form.querySelector("[aria-invalid=true]").focus();return}
 var parts=dt.split("-"),nice=parts[2]+"/"+parts[1]+"/"+parts[0];
 var msg="Hello MAA KAMAKHYA TOUR & TRAVELS, I would like to enquire about a ride.\n\n"+
  "Pickup: "+p+"\nDestination: "+d+"\nDate: "+nice+"\nRide type: "+$("#type").value+
  "\nVehicle: "+$("#vehicle").value+"\nPassengers: "+$("#pax").value+"\n\nPlease confirm availability and fare.";
 var url="https://wa.me/"+BUSINESS_WA+"?text="+encodeURIComponent(msg);
 var w=window.open(url,"_blank","noopener");
 $("#formNote").innerHTML="WhatsApp should now be open with your details. Review and send the message — your ride is not booked until the business confirms it. "+(w?"":'Popup blocked? <a href="'+url+'" target="_blank" rel="noopener">Open WhatsApp</a>.');
});
["pickup","dest","date"].forEach(function(id){$("#"+id).addEventListener("input",function(){fail(id,"")})});

// Lightbox
var lb=$("#lb"),lbImg=$("#lbImg"),last;
function closeLb(){lb.hidden=true;if(last)last.focus()}
$("#gal").addEventListener("click",function(e){var b=e.target.closest(".gi");if(!b)return;last=b;var i=b.querySelector("img");lbImg.src=i.src;lbImg.alt=i.alt;lb.hidden=false;$("#lbClose").focus()});
$("#lbClose").addEventListener("click",closeLb);
lb.addEventListener("click",function(e){if(e.target===lb)closeLb()});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){if(!lb.hidden)closeLb();setMenu(false)}});
})();