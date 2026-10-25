const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
vm.runInNewContext(babel.transformSync(fs.readFileSync('src/api/retryAnalysis.js','utf8'), {configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{exports:exportsObject});
const { retryAnalysis } = exportsObject;
test('invalid analysis is retried twice and can succeed on the third attempt', async () => {
 let count=0; const result=await retryAnalysis(async()=>{if(++count<3)throw new Error('Invalid format from AI');return {calories:100};});
 assert.equal(count,3);assert.equal(result.calories,100);
});
test('three invalid replies expose the final error without a fourth request', async () => {
 let count=0;await assert.rejects(retryAnalysis(async()=>{count++;throw new Error('Empty response from Gemini.');}),/Empty response/);assert.equal(count,3);
});
test('auth, billing, quota, not-food and configuration failures are not repeated', async () => {
 for(const message of ['missing_api_key','ai_request_failed','not_food','claude_voice_setup','empty_transcription']){
  let count=0;await assert.rejects(retryAnalysis(async()=>{count++;throw new Error(message);},{aiProvider:'claude'}));assert.equal(count,1);
 }
});
test('cancellation between attempts prevents another request', async () => {
 const controller=new AbortController();let count=0;
 await assert.rejects(retryAnalysis(async()=>{count++;controller.abort();throw new Error('Invalid format from AI');},{signal:controller.signal}),e=>e.name==='AbortError');assert.equal(count,1);
});
