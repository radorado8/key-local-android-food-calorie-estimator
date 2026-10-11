const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const babel = require('@babel/core');
const exportsObject = {};
vm.runInNewContext(babel.transformFileSync('src/utils/reanalyzeMeal.js', {configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code, { exports: exportsObject });
const { reanalyzedMealPatch } = exportsObject;
const draft = { id:'original', timestamp:'2025-02-01T10:30:00Z', imageUri:'file:///meal.jpg', categoryId:'lunch', name:'Meal', calories:1 };
const result = { name:'Apple', calories:80.4, protein:0.5, carbs:20.2, fat:0.1, weight_g:150.5, timestamp:'2026-10-10', imageUri:'wrong', id:'new' };
test('reanalysis preserves original identity, date, photo and category and updates nutrition', () => {
 const patch = reanalyzedMealPatch(draft,result);
 for (const key of ['id','timestamp','imageUri','categoryId']) assert.equal(patch[key],draft[key]);
 assert.equal(patch.name,'Apple'); assert.equal(patch.calories,80); assert.equal(patch.weight_g,150.5);
 assert.equal(draft.calories,1);
});
test('invalid analysis must not overwrite a meal with missing or negative nutrition', () => {
 for (const value of [undefined,null,-1,NaN,Infinity,'invalid']) assert.throws(() => reanalyzedMealPatch(draft,{...result,calories:value}));
 assert.equal(reanalyzedMealPatch(draft,{...result,calories:0}).calories,0);
});
