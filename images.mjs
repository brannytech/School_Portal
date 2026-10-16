// Remove metadata from browser-independent uploads too, rather than trusting clients.
export function cleanImage(bytes){
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const bad=()=>{throw Object.assign(new Error('Upload a valid JPEG or PNG image.'),{status:400});};
 if(png){
  const chunks=[bytes.subarray(0,8)];let cursor=8,header=false,end=false;
  while(cursor+12<=bytes.length){const length=bytes.readUInt32BE(cursor),type=bytes.toString('ascii',cursor+4,cursor+8);if(length>bytes.length-cursor-12)bad();const chunk=bytes.subarray(cursor,cursor+12+length);if(type==='IHDR'){if(length!==13)bad();const w=bytes.readUInt32BE(cursor+8),h=bytes.readUInt32BE(cursor+12);if(!w||!h||w*h>30000000)bad();header=true;}if(!['eXIf','tEXt','zTXt','iTXt','tIME'].includes(type))chunks.push(chunk);cursor+=12+length;if(type==='IEND'){end=true;break;}}
  if(!header||!end)bad();return {bytes:Buffer.concat(chunks),type:'image/png'};
 }
 if(jpeg){
  const chunks=[bytes.subarray(0,2)];let cursor=2,scan=false;
  while(cursor<bytes.length){if(bytes[cursor]!==255)bad();let markerStart=cursor;while(bytes[cursor]===255)cursor++;const marker=bytes[cursor++];if(marker===217){chunks.push(bytes.subarray(markerStart,cursor));break;}if(marker===218){chunks.push(bytes.subarray(markerStart));scan=true;break;}if(marker===0||marker===216||cursor+2>bytes.length)bad();const length=bytes.readUInt16BE(cursor);if(length<2||cursor+length>bytes.length)bad();if(marker!==225&&marker!==237&&marker!==254)chunks.push(bytes.subarray(markerStart,cursor+length));cursor+=length;}
  if(!scan||bytes[bytes.length-2]!==255||bytes[bytes.length-1]!==217)bad();return {bytes:Buffer.concat(chunks),type:'image/jpeg'};
 }
 bad();
}
