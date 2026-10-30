// Lesson images: shrink in the browser, then upload. Large phone photos become a sensible size and lose their location data.
const MAX_SIDE=1600,MAX_BYTES=4.5*1024*1024;

export async function prepareImage(file){
 if(!/^image\/(jpeg|png)$/.test(file.type))throw Error('Choose a JPEG or PNG image.');
 const bitmap=await createImageBitmap(file);
 const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d');
 if(file.type==='image/jpeg'){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);}
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 // Keep PNG for diagrams (sharp edges) and JPEG for photographs.
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,file.type,0.86));
 if(blob&&blob.size>MAX_BYTES&&file.type==='image/png')blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.82));
 if(!blob||blob.size>MAX_BYTES)throw Error('This image is too large even after shrinking. Try a smaller picture.');
 return blob;
}

// upload(blob) -> file id (provided by the page, which owns the session token).
export async function uploadLessonImage(file,upload){return upload(await prepareImage(file));}
export function pickImageFile(){
 return new Promise(resolve=>{
  const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png';input.style.display='none';
  input.addEventListener('change',()=>{resolve(input.files[0]||null);input.remove();},{once:true});
  input.addEventListener('cancel',()=>{resolve(null);input.remove();},{once:true});
  document.body.append(input);input.click();
 });
}
