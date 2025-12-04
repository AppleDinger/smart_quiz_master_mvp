// data-store.js
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { join } = require('path');
const { nanoid } = require('nanoid');

// Path to JSON file
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter, { users: [] });

// Initialize file
async function init() {
  await db.read();
  db.data ||= { users: [] };
  await db.write();
}

async function saveAttempt(username, attempt) {
  await db.read();
  
  let user = db.data.users.find(u => u.username === username);
  if (!user) {
    user = { username, attempts: [] };
    db.data.users.push(user);
  }

  user.attempts.push({
    id: nanoid(),
    createdAt: new Date().toISOString(),
    ...attempt
  });

  await db.write();
}

async function getAllUsers() {
  await db.read();
  return db.data.users;
}

module.exports = { init, saveAttempt, getAllUsers };
