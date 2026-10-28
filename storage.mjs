import fs from 'node:fs';
import path from 'node:path';
import {cleanImage} from './images.mjs';
let client;
export function validateFile(bytes,purpose){
 if(bytes.length<4)throw Object.assign(Error('The file is empty or invalid.'),{status:400});
 if(bytes[0]===255&&bytes[1]===216||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return cleanImage(bytes);
 if(['note','question','lesson-image'].includes(purpose))throw Object.assign(Error('Choose a JPEG or PNG image.'),{status:400});
 if(bytes.subarray(0,5).toString()==='%PDF-')return {bytes,type:'application/pdf'};
 if(bytes.subarray(0,2).toString()==='PK'&&bytes.includes(Buffer.from('[Content_Types].xml'))&&bytes.includes(Buffer.from('word/')))return {bytes,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
 if(purpose==='recording'&&(bytes.toString('ascii',4,8)==='ftyp'||bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))))return {bytes,type:bytes.toString('ascii',4,8)==='ftyp'?'video/mp4':'video/webm'};
 throw Object.assign(Error('Choose a supported photograph, PDF, DOCX document or lesson video.'),{status:400});
}
async function s3(){if(!client){const {S3Client}=await import('@aws-sdk/client-s3');if(!process.env.S3_BUCKET)throw Error('S3_BUCKET is required for object storage.');client=new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT||undefined,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true'});}return client;}
export async function storeFile(directory,id,bytes,type){
 if(process.env.STORAGE_DRIVER==='s3'){const {PutObjectCommand}=await import('@aws-sdk/client-s3');await(await s3()).send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:'private/'+id,Body:bytes,ContentType:type}));return 's3';}
 fs.mkdirSync(path.join(directory,'uploads'),{recursive:true});fs.writeFileSync(path.join(directory,'uploads',id),bytes,{flag:'wx'});return 'local';
}
export async function streamFile(directory,file,req,res,cache='no-store'){
 const headers={'Content-Type':file.type,'Cache-Control':cache,'Accept-Ranges':'bytes','Content-Disposition':file.type.startsWith('image/')||file.type.startsWith('video/')?'inline':`attachment; filename="${file.id}.${file.type==='application/pdf'?'pdf':'docx'}"`};
 if(file.storage==='s3'){const {GetObjectCommand}=await import('@aws-sdk/client-s3');const result=await(await s3()).send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:'private/'+file.id,Range:req.headers.range}));if(result.ContentLength)headers['Content-Length']=result.ContentLength;if(result.ContentRange)headers['Content-Range']=result.ContentRange;res.writeHead(result.ContentRange?206:200,headers);result.Body.pipe(res);return;}
 const filepath=path.join(directory,'uploads',file.id),size=fs.statSync(filepath).size;const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(filepath,{start,end}).pipe(res);return;}
 res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(filepath).pipe(res);
}
