import React, { useState } from 'react';

const USERS_DB_KEY = "smartQuizUsers";

export default function Auth({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  const getUsers = () => JSON.parse(localStorage.getItem(USERS_DB_KEY) || "{}");

  const handleAction = (isRegister) => {
    if (!username || !password) return setError("All fields required.");
    const users = getUsers();
    
    if (isRegister) {
      if (users[username]) return setError("Username taken.");
      users[username] = password;
      localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
      onLogin(username);
    } else {
      if (users[username] !== password) return setError("Invalid credentials.");
      onLogin(username);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <h1 className="text-4xl font-black text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Smart Quiz</h1>
        <div className="space-y-4">
          <input className="w-full p-4 border rounded-xl" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input className="w-full p-4 border rounded-xl" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="text-red-500 text-center text-sm">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => handleAction(false)} className="flex-1 bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600">Login</button>
            <button onClick={() => handleAction(true)} className="flex-1 bg-gray-100 font-bold py-3 rounded-xl hover:bg-gray-200">Register</button>
          </div>
        </div>
      </div>
    </div>
  );
}