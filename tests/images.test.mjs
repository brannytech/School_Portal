import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cleanImage} from '../images.mjs';
test('JPEG upload metadata is stripped on the server',()=>{
 const photo=fs.readFileSync('public/assets/school-building.jpeg');
 const metadata=Buffer.from('Exif\0\0private GPS data');const app1=Buffer.alloc(metadata.length+4);app1[0]=255;app1[1]=225;app1.writeUInt16BE(metadata.length+2,2);metadata.copy(app1,4);
 const withExif=Buffer.concat([photo.subarray(0,2),app1,photo.subarray(2)]),result=cleanImage(withExif);
 assert.equal(result.type,'image/jpeg');assert(!result.bytes.includes(Buffer.from('private GPS data')));assert.deepEqual(result.bytes,cleanImage(photo).bytes);
});
test('Invalid and truncated images are rejected',()=>{
 for(const bytes of [Buffer.from('<script>alert(1)</script>'),Buffer.from([255,216,255]),Buffer.from([137,80,78,71,13,10,26,10])])assert.throws(()=>cleanImage(bytes),{status:400});
});
