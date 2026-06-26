const Dexie = require('dexie');
const fakeIndexedDB = require('fake-indexeddb');
const fakeIDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

async function run() {
  const db = new Dexie('test_db', { indexedDB: fakeIndexedDB, IDBKeyRange: fakeIDBKeyRange });
  db.version(1).stores({
    a: 'id',
    b: 'id'
  });
  db.version(2).stores({
    b: 'id, name'
  });
  await db.open();
  console.log(db.tables.map(t => t.name));
}
run();
