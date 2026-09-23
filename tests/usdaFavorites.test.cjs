const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const foods = require('../src/data/usdaCommonFoods.json');

function loadModule(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    babelrc: false, configFile: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, console,
    require: name => name in mocks ? mocks[name] : require(path.resolve(path.dirname(filename), name)),
  }, { filename });
  return module.exports;
}

const { upgradeUsdaFavoriteNames } = loadModule('src/utils/usdaFavoriteNames.js');
const lists = [{ id: 'usda', name: foods.list.names.sk }, { id: 'default', name: 'Obľúbené' }];
const legacyFavorites = () => foods.favorites.map((food, index) => ({
  id: `favorite-${index}`, listId: 'usda', name: food.legacySkName.slice(0, 100),
  calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat,
  weight_g: food.weight_g, imageUri: `file:///photo-${index}.jpg`, categoryId: 'mine',
  createdAt: '2026-09-01T12:00:00.000Z',
}));

test('all 1,000 Slovak names fit imports and omit raw labels', () => {
  assert.equal(foods.favorites.length, 1000);
  for (const food of foods.favorites) {
    assert.ok(food.names.sk.trim().length > 0 && food.names.sk.length <= 100);
    assert.doesNotMatch(food.names.sk, /\braw\b|surov[áéýíú]/i);
    assert.equal(food.name, food.names.en);
  }
  assert.equal(foods.favorites.find(f => f.name === 'Cornsalad, Raw').names.sk, 'Poľníček');
  assert.equal(foods.favorites.find(f => f.name === 'Jerusalem-Artichokes, Raw').names.sk, 'Topinambury');
});

test('upgrade changes only names, preserves IDs, images, nutrients and categories, and is idempotent', () => {
  const old = legacyFavorites();
  const before = JSON.stringify(old);
  const updated = upgradeUsdaFavoriteNames(old, lists);
  for (let i = 0; i < old.length; i++) {
    const { name, ...rest } = updated[i];
    const { name: oldName, ...original } = old[i];
    assert.deepEqual(rest, original);
    assert.equal(name, foods.favorites[i].names.sk);
  }
  assert.equal(JSON.stringify(old), before);
  assert.equal(JSON.stringify(upgradeUsdaFavoriteNames(updated, lists)), JSON.stringify(updated));
});

test('upgrade preserves unrelated names, portions and nutrition', () => {
  const [food] = legacyFavorites();
  for (const patch of [{ name: 'Moje jedlo' }, { weight_g: 200 }, { calories: 999 }]) {
    const edited = { ...food, ...patch };
    assert.equal(upgradeUsdaFavoriteNames([edited], lists)[0], edited);
  }
});

test('old AI translations are corrected in renamed libraries and moved favorites', () => {
  const food = legacyFavorites()[13];
  for (const listId of ['renamed-library', 'default']) {
    const moved = { ...food, listId };
    const updated = upgradeUsdaFavoriteNames([moved])[0];
    assert.equal(updated.name, 'Poľníček');
    assert.equal(updated.listId, listId);
    assert.equal(updated.id, food.id);
  }
});

function serviceFixture(failListWrite = false) {
  const old = legacyFavorites();
  const storage = new Map([
    ['favorites.v1', JSON.stringify(old)], ['favorites.lists.v1', JSON.stringify(lists)],
  ]);
  const service = loadModule('src/api/favoritesService.js', {
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) || null,
      setItem: async (key, value) => {
        if (failListWrite && key === 'favorites.lists.v1') throw new Error('Disk full');
        storage.set(key, value);
      },
      multiSet: async pairs => pairs.forEach(([key, value]) => storage.set(key, value)),
    },
    'expo-file-system/legacy': {}, 'expo-image-manipulator': {},
    '../utils/usdaFavoriteNames': { upgradeUsdaFavoriteNames },
  });
  return { service, storage, old };
}

test('initialization backs up the complete old favorites before replacing names', async () => {
  const { service, storage, old } = serviceFixture();
  await service.getFavoriteImageUris();
  assert.equal(storage.get('favorites.backup.preUsdaSlovakNames.v1'), JSON.stringify(old));
  assert.equal(JSON.parse(storage.get('favorites.v1'))[13].name, 'Poľníček');
});

test('importing an older JSON backup immediately corrects its AI translations', async () => {
  const { service, storage } = serviceFixture();
  const { list } = await service.importFavoriteList({
    format: 'calories-ai-favorites', version: 1,
    list: { name: 'Moja premenovaná knižnica' },
    favorites: [{ ...legacyFavorites()[13], imageUri: null }],
  }, 'sk');
  const imported = JSON.parse(storage.get('favorites.v1')).find(food => food.listId === list.id);
  assert.equal(imported.name, 'Poľníček');
});

test('rename trims and persists a library name, protects default, rejects whitespace', async () => {
  const { service, storage } = serviceFixture();
  await service.renameFavoriteList('usda', '  Moje potraviny  ');
  assert.equal(JSON.parse(storage.get('favorites.lists.v1'))[0].name, 'Moje potraviny');
  await service.renameFavoriteList('default', 'Changed');
  assert.equal(JSON.parse(storage.get('favorites.lists.v1'))[1].name, 'Obľúbené');
  await assert.rejects(service.renameFavoriteList('usda', '   '));
});

test('failed rename preserves persisted and cached library name', async () => {
  const { service, storage } = serviceFixture(true);
  await assert.rejects(service.renameFavoriteList('usda', 'Changed'), /Disk full/);
  assert.equal(JSON.parse(storage.get('favorites.lists.v1'))[0].name, foods.list.names.sk);
  const cached = await new Promise(resolve => {
    const unsubscribe = service.subscribeFavoriteLists(value => { unsubscribe(); resolve(value); });
  });
  assert.equal(cached[0].name, foods.list.names.sk);
});
