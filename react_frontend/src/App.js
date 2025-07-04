import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// === Firebase import and initialization ===
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA2-rz74A7WBG9hvShAxOUmaSzu-_XIqYc',
  authDomain: 'doodlefinder.firebaseapp.com',
  projectId: 'doodlefinder',
  storageBucket: 'doodlefinder.appspot.com',
  messagingSenderId: '251317683837',
  appId: '1:251317683837:web:2a3830aad29463faebd84a',
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// === IMGBB API KEY ===
const IMGBB_API_KEY = '6da4466201de0f91b97df4fe129c6d7a';

// ==== Game Prompts for Spinning Wheel ====
const PROMPTS = [
  'Giraffe', 'Owl', 'Cat', 'Dog', 'Rabbit', 'Pig', 'Dinosaur', 'Elephant',
  'Banana', 'Penguin', 'Crocodile', 'Lion', 'Tiger', 'Frog', 'Horse', 'Monkey'
];

// ==== Utility - Random Element ====
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ==== Theme colors ====
const gameTheme = {
  primary: '#5fc0fc',
  secondary: '#fcfcfc',
  accent: '#100f0f',
};

// ==== Helper functions ====
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==== Drawing Canvas Component ====
function DrawingCanvas({ onFinishDrawing, disabled, timeLeft }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Drawing event handlers
  const startDrawing = (e) => {
    if (disabled) return;
    setDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    let x, y;
    if (e.touches) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }
    lastPos.current = { x, y };
  };
  const draw = (e) => {
    if (!drawing || disabled) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    let x, y;
    if (e.touches) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.nativeEvent.offsetX;
      y = e.nativeEvent.offsetY;
    }
    ctx.strokeStyle = gameTheme.primary;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPos.current = { x, y };
  };
  const endDrawing = () => setDrawing(false);
  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 320, 320);
  };

  // Expose finish method
  const handleFinishClick = async () => {
    // Export canvas to data URL
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onFinishDrawing(dataUrl);
  };

  return (
    <div style={{ padding: 8, background: "#fff", borderRadius: 12, border: `2px solid ${gameTheme.primary}` }}>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        style={{
          background: "#fcfcfc",
          border: `2px dashed ${gameTheme.primary}`,
          borderRadius: 8,
          touchAction: "none",
          boxShadow: "0 1px 6px rgba(0,0,0,0.08)"
        }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
        disabled={disabled}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={clearCanvas} className="btn" disabled={disabled} style={{ marginRight: 8 }}>Clear</button>
        <button onClick={handleFinishClick} className="btn" disabled={disabled}>Done</button>
        <div style={{ color: "#aaa", marginTop: 5, fontSize: 13 }}>{!disabled ? `Time left: ${timeLeft}s` : 'Drawing disabled'}</div>
      </div>
    </div>
  );
}

// ==== Spinning Wheel Component ====
function SpinningWheel({ prompt, spinning, onSpin, spinningPrompt }) {
  // A simple visual highlight spin wheel
  return (
    <div style={{ margin: "18px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{
        width: 240, height: 60, background: "#fff", borderRadius: '2rem',
        border: `2px solid ${gameTheme.primary}`, display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 30, color: gameTheme.primary, marginBottom: 6, position: "relative"
      }}>
        {spinning
          ? <span style={{ fontStyle: "italic", color: "#ccc" }}>{spinningPrompt || "???"}</span>
          : <span>{prompt ? prompt : "Spin for your animal prompt!"}</span>
        }
      </div>
      <button onClick={onSpin} className="btn-large" style={{ marginTop: 2 }} disabled={spinning || prompt}>
        {spinning ? "Spinning..." : prompt ? "Prompt Assigned" : "Spin!"}
      </button>
    </div>
  );
}

// ==== Game Lobby Component ====
function Lobby({ username, setUsername, onRoomSet, currentRoom, rooms }) {
  const [joining, setJoining] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [error, setError] = useState("");
  const handleJoin = (room) => {
    setJoining(true);
    setUsername(username);
    onRoomSet(room);
    setTimeout(() => setJoining(false), 800);
  };
  const handleCreate = () => {
    if (newRoom.trim().length < 3) {
      setError("Room name too short");
      return;
    }
    if (rooms.includes(newRoom)) {
      setError("Room exists");
      return;
    }
    setJoining(true);
    setError("");
    onRoomSet(newRoom);
    setTimeout(() => setJoining(false), 500);
  };
  return (
    <div style={{ padding: 24, maxWidth: 350, margin: "0 auto", borderRadius: 16, background: "#fff", boxShadow: "0 1px 18px 2px #eee", border: `2px solid ${gameTheme.primary}` }}>
      <h2 style={{ color: gameTheme.primary }}>Welcome to Doodle Finder!</h2>
      <div>
        <input
          type="text"
          placeholder="Pick a username..."
          value={username}
          onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15))}
          maxLength={15}
          style={{ fontSize: 18, padding: 6, borderRadius: 6, border: '1px solid #aaa', width: "80%", marginBottom: 12 }}
        />
      </div>
      <div style={{ margin: "14px 0", fontWeight: 600, color: "#444" }}>Or join a room:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", minHeight: "40px" }}>
        {rooms.length === 0 ? <span style={{ color: "#aaa" }}>No rooms yet.</span> : rooms.map(
          room => (
            <button key={room} className="btn" style={{
              background: gameTheme.primary, color: "#fff", minWidth: 70, borderRadius: "20px"
            }} onClick={() => handleJoin(room)} disabled={joining}>
              {room}
            </button>
          )
        )}
      </div>
      <div style={{ marginTop: "16px", fontWeight: 500, fontSize: "15px" }}>or create a new room:</div>
      <input
        type="text"
        style={{ borderRadius: 6, border: '1px solid #aaa', fontSize: 16, padding: 6, marginTop: 8, width: "70%" }}
        placeholder="New room name"
        value={newRoom}
        onChange={e => { setNewRoom(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15)); setError(""); }}
      />
      <button className="btn" onClick={handleCreate} style={{ marginLeft: 9 }} disabled={joining}>
        Create
      </button>
      {error && <div style={{ color: "#d33", marginTop: 6, fontWeight: 500 }}>{error}</div>}
      {currentRoom && (
        <div style={{ marginTop: 20, color: "#333" }}>
          Joined room <span style={{ color: gameTheme.primary, fontWeight: 600 }}>{currentRoom}</span>
        </div>
      )}
    </div>
  );
}

// ==== Timer Bar Component ====
function TimerBar({ totalTime, timeLeft }) {
  const percent = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100));
  return (
    <div style={{ width: 220, height: 11, background: "#eee", borderRadius: 7, margin: "9px auto", overflow: "hidden" }}>
      <div
        style={{
          width: percent + '%', height: "100%",
          background: gameTheme.primary, borderRadius: 7, transition: "width 0.25s linear"
        }} />
    </div>
  );
}

// ==== Submission Review Component ====
function SubmissionsPhase({ drawings, guesses, currentUser, onSubmitGuess, onVote, phase, votedFor, votingOpen, winner, players }) {
  // phase: 'guess', 'vote', 'winner'
  const [guessValue, setGuessValue] = useState('');
  const [alreadyGuessed, setAlreadyGuessed] = useState(false);
  if (!drawings || !Object.keys(drawings).length) return null;

  // Guess phase: only show others' drawings; Vote phase: show all submissions
  const guessTargets = Object.entries(drawings)
    .filter(([uid]) => uid !== currentUser.uid);

  // Winner phase: get winner info
  let winnerMarkup = null;
  if (phase === "winner" && winner) {
    const submission = drawings[winner.uid];
    const winnerName = players[winner.uid]?.username || winner.uid;
    winnerMarkup = (
      <div style={{ marginTop: 16, background: "#f7fdfa", border: `2px solid ${gameTheme.primary}`, borderRadius: 16, padding: 18, maxWidth: 380, margin: "18px auto" }}>
        <h3>🏆 Winner: <span style={{ color: gameTheme.primary }}>{winnerName}</span></h3>
        <div>
          <img src={submission.url} alt="Winner's Drawing" style={{ width: 140, height: 140, objectFit: "contain", borderRadius: 12, border: '2px solid #ddd' }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 22, fontWeight: 600 }}>Prompt: {submission.prompt}</div>
        <div>Guessed by: <span style={{ color: gameTheme.primary }}>{submission.guessedBy?.length || 0} players</span></div>
      </div>
    );
  }

  return (
    <div>
      {phase === "guess" && (
        <div>
          <h3 style={{ color: gameTheme.primary }}>Guess the drawings!</h3>
          {guessTargets.length === 0 && <p>No other drawings...</p>}
          {guessTargets.map(([uid, submission], idx) => (
            <div key={uid} style={{ margin: "28px 0", background: "#f7fdfa", borderRadius: 10, padding: 14, boxShadow: "0 1px 6px #eee" }}>
              <img src={submission.url} alt="drawing" style={{
                width: 170, height: 170,
                objectFit: "contain", borderRadius: 12, border: '2px solid #bbb'
              }} />
              <form
                onSubmit={e => {
                  e.preventDefault();
                  onSubmitGuess(uid, guessValue.trim());
                  setGuessValue('');
                  setAlreadyGuessed(true);
                  setTimeout(() => setAlreadyGuessed(false), 1500);
                }}
              >
                <input
                  type="text"
                  value={guessValue}
                  onChange={e => setGuessValue(e.target.value)}
                  placeholder="Your guess"
                  style={{
                    fontSize: 18, padding: "7px 10px", borderRadius: 7, border: `1.5px solid ${gameTheme.primary}`, width: 120, margin: "12px 8px 0 0"
                  }}
                  disabled={alreadyGuessed}
                  required
                />
                <button className="btn" type="submit" disabled={alreadyGuessed || !guessValue}>Guess</button>
              </form>
              {!!guesses[uid] && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#0b6" }}>
                  Your guess: {guesses[uid]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {phase === "vote" && (
        <div>
          <h3 style={{ color: gameTheme.primary }}>Vote for the best drawing!</h3>
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "30px 25px", justifyContent: "center", padding: 16
          }}>
            {Object.entries(drawings).map(([uid, submission]) => (
              <div key={uid} style={{ position: "relative", background: "#fff", borderRadius: 13, padding: 12, boxShadow: "0 1px 8px 0 #eee", border: `2px solid ${gameTheme.primary}` }}>
                <img src={submission.url} alt="drawing" style={{
                  width: 120, height: 120, objectFit: "contain", borderRadius: 12, border: '2px solid #bbb'
                }} />
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 5 }}>Prompt: {submission.prompt}</div>
                <button
                  className="btn"
                  onClick={() => onVote(uid)}
                  style={{
                    background: (votedFor === uid) ? "#eee" : gameTheme.primary,
                    color: (votedFor === uid) ? "#777" : "#fff",
                    marginTop: 9, borderRadius: 20, fontSize: 14
                  }}
                  disabled={!!votedFor || uid === currentUser.uid || !votingOpen}
                >
                  {votedFor === uid ? "Voted" : (uid === currentUser.uid ? "Can't vote self" : "Vote")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {phase === "winner" && (
        <div>
          <h3 style={{ color: gameTheme.primary }}>Results!</h3>
          {winnerMarkup}
          <div style={{ marginTop: 30, fontSize: 15, color: "#666" }}>
            <span>Play again?</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==== Upload Image to IMGBB ====
async function uploadDrawingToIMGBB(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.readAsDataURL(blob);
  }));
  const resp = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData
  });
  if (!resp.ok) throw new Error("IMGBB upload failed");
  const json = await resp.json();
  return json.data.url;
}

// ==== Main App ====
function App() {
  // Auth & shared state
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [room, setRoom] = useState("");
  const [rooms, setRooms] = useState([]);
  const [phase, setPhase] = useState('lobby'); // 'lobby', 'spin', 'draw', 'guess', 'vote', 'winner'
  const [prompt, setPrompt] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [spinningPrompt, setSpinningPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [drawings, setDrawings] = useState({});
  const [guesses, setGuesses] = useState({});
  const [votingOpen, setVotingOpen] = useState(false);
  const [votes, setVotes] = useState({});
  const [winner, setWinner] = useState(null);
  const [players, setPlayers] = useState({});
  const [votedFor, setVotedFor] = useState('');

  // App theme
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Effect: Firebase Auth listener (anonymous or username)
  useEffect(() => {
    return onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser);
    });
  }, []);

  // Effect: Room polling
  useEffect(() => {
    // Room list subscription
    const unsub = onSnapshot(collection(db, "rooms"), (snap) => {
      const list = [];
      snap.forEach(doc => list.push(doc.id));
      setRooms(list);
    });
    return unsub;
  }, []);

  // On room join, set up player
  useEffect(() => {
    if (room && user) {
      // Register player in DB
      const playerRef = doc(db, "rooms", room, "players", user.uid);
      setDoc(playerRef, {
        username: username || "player" + randItem([
          Math.floor(Math.random() * 1000), Math.floor(Math.random() * 9000)
        ]),
        joined: serverTimestamp()
      }, { merge: true });
      // Listen to room meta (phase, prompt, etc)
      const roomRef = doc(db, "rooms", room);
      const unsubMeta = onSnapshot(roomRef, (dsnap) => {
        const data = dsnap.data();
        if (data) {
          setPhase(data.phase || 'lobby');
          setPrompt(data.prompt || '');
          setVotingOpen(!!data.votingOpen);
          setWinner(data.winner || null);
          setTimeLeft(data.timeLeft || 30);
        }
      });
      // Listen to player roster
      const unsubPlayers = onSnapshot(collection(db, "rooms", room, "players"),
        (snap) => {
          const ppl = {};
          snap.forEach(doc => ppl[doc.id] = doc.data());
          setPlayers(ppl);
        });
      // Listen to drawings submissions
      const unsubDrawings = onSnapshot(collection(db, "rooms", room, "drawings"),
        (snap) => {
          const drs = {};
          snap.forEach(doc => drs[doc.id] = doc.data());
          setDrawings(drs);
        });
      // Listen to guesses
      const unsubGuesses = onSnapshot(collection(db, "rooms", room, "guesses"),
        (snap) => {
          const g = {};
          snap.forEach(doc => g[doc.id] = doc.data());
          setGuesses(g);
        });
      // Listen to votes
      const unsubVotes = onSnapshot(collection(db, "rooms", room, "votes"),
        (snap) => {
          const v = {};
          snap.forEach(doc => v[doc.id] = doc.data());
          setVotes(v);
          setVotedFor((v[user.uid] && v[user.uid].voteFor) || '');
        });
      return () => {
        unsubMeta();
        unsubPlayers();
        unsubDrawings();
        unsubGuesses();
        unsubVotes();
      };
    }
  }, [room, user, username]);

  // ==== Auth/Join handler ====
  const handleLogin = async () => {
    try {
      setAuthError('');
      if (!username.trim()) throw new Error("Enter a username");
      await signInAnonymously(auth);
    } catch (e) {
      setAuthError(e.message);
    }
  };

  // ==== Room creation/join handler ====
  const handleRoomSet = async (roomName) => {
    if (!user) {
      setAuthError("Login required.");
      return;
    }
    const roomRef = doc(db, 'rooms', roomName);
    const docSnap = await getDoc(roomRef);
    if (!docSnap.exists()) {
      // Create room document with default state
      await setDoc(roomRef, {
        phase: 'lobby',
        created: serverTimestamp(),
        prompt: '',
        votingOpen: false,
        winner: null,
        timeLeft: 30
      });
    }
    setRoom(roomName);
    setPhase('lobby');
  };

  // ==== Spinning wheel handler (choose prompt) ====
  const handleSpinWheel = async () => {
    setSpinning(true);
    let showPrompt = '';
    for (let i = 0; i < 18; i++) {
      showPrompt = randItem(PROMPTS);
      setSpinningPrompt(showPrompt);
      // Emulate spin speed change
      await sleep(35 + i * 8);
    }
    setSpinningPrompt('');
    setPrompt(showPrompt);
    // Set prompt in the room doc
    await updateDoc(doc(db, "rooms", room), {
      prompt: showPrompt,
      phase: "draw",
      timeLeft: 30,
      votingOpen: false,
      winner: null
    });
    setSpinning(false);
  };

  // ==== Drawing submission handler ====
  const handleSubmitDrawing = async (dataUrl) => {
    // Upload image to IMGBB
    let imgurl = '';
    try {
      imgurl = await uploadDrawingToIMGBB(dataUrl);
    } catch (e) {
      alert("Image upload failed. Try again.");
      return;
    }
    const submissionDoc = doc(db, "rooms", room, "drawings", user.uid);
    await setDoc(submissionDoc, {
      url: imgurl,
      prompt,
      user: user.uid,
      guessedBy: [],
      timestamp: serverTimestamp(),
    });
    // Notify that you're ready (wait for others)
    await updateDoc(doc(db, "rooms", room), { phase: "guess" });
  };

  // ==== Guess submission handler ====
  const handleSubmitGuess = async (drawingUid, guessText) => {
    if (!drawingUid || !guessText) return;
    const guessDoc = doc(db, "rooms", room, "guesses", user.uid + "_" + drawingUid);
    await setDoc(guessDoc, {
      drawingUid, guessText, user: user.uid
    });
    // Update guessedBy in drawing
    const drawRef = doc(db, "rooms", room, "drawings", drawingUid);
    const drawSnap = await getDoc(drawRef);
    if (drawSnap.exists()) {
      const guessedBy = drawSnap.data().guessedBy || [];
      if (!guessedBy.includes(user.uid)) {
        await updateDoc(drawRef, { guessedBy: [...guessedBy, user.uid] });
      }
    }
  };

  // ==== Voting handler ====
  const handleVote = async (drawingUid) => {
    if (!drawingUid) return;
    if (drawingUid === user.uid) return; // No self-vote rule
    const voteDoc = doc(db, "rooms", room, "votes", user.uid);
    await setDoc(voteDoc, { voteFor: drawingUid });
    setVotedFor(drawingUid);
    // Optional: Could count votes, then set winner in room
    // Here, backend/host should do so. Winner calculation will be based on votes + guesses.
  };

  // ==== Play Again handler ====
  const handlePlayAgain = async () => {
    // Reset state for another round - clear submissions/guesses/votes, then phase=spin
    const batchDelete = async (subcollection) => {
      const coll = collection(db, "rooms", room, subcollection);
      const docsSnap = await getDocs(coll);
      const deletions = [];
      docsSnap.forEach(docSnap => deletions.push(setDoc(docSnap.ref, {}, { merge: false })));
      return Promise.all(deletions);
    };
    await batchDelete("drawings");
    await batchDelete("guesses");
    await batchDelete("votes");
    await updateDoc(doc(db, "rooms", room), { phase: "spin", prompt: "", votingOpen: false, winner: null, timeLeft: 30 });
    setPrompt('');
    setWinner(null);
    setDrawings({});
    setGuesses({});
    setVotes({});
    setVotedFor('');
    setPhase('spin');
  };

  // ==== Phase transitions ====
  // Drawing timer management - a single player can become "host"/admin (first join)
  useEffect(() => {
    if (
      phase === "draw" &&
      user &&
      room &&
      players && Object.keys(players)[0] === user.uid
    ) {
      // The "host" (player0) controls the timer
      let timeoutId;
      let remaining = 30;
      const tick = async () => {
        if (remaining <= 0) {
          // Move to guess phase
          await updateDoc(doc(db, "rooms", room), { phase: "guess" });
          clearTimeout(timeoutId);
          return;
        }
        await updateDoc(doc(db, "rooms", room), { timeLeft: remaining });
        remaining--;
        timeoutId = setTimeout(tick, 1000);
      };
      tick();
      return () => clearTimeout(timeoutId);
    }
  }, [phase, user, room, players]);

  // Winner calculation (by host on voting end)
  useEffect(() => {
    if (
      phase === "vote" &&
      user &&
      room &&
      players && Object.keys(players)[0] === user.uid &&
      votingOpen
    ) {
      // After a period, determine winner
      let timeoutId;
      const winnerTimeout = async () => {
        await updateDoc(doc(db, "rooms", room), { votingOpen: false });
        // Calc winner
        // Winner is the drawing with the most votes (votes[voteFor]), ties resolved by guesses
        const voteCounts = {};
        Object.values(votes).forEach(v => {
          voteCounts[v.voteFor] = (voteCounts[v.voteFor] || 0) + 1;
        });
        let maxVotes = -1;
        let winners = [];
        Object.entries(voteCounts).forEach(([uid, cnt]) => {
          if (cnt > maxVotes) {
            maxVotes = cnt;
            winners = [uid];
          } else if (cnt === maxVotes) {
            winners.push(uid);
          }
        });
        // Tiebreaker: guessedBy length
        let winnerUid = winners[0] || '';
        if (winners.length > 1 && drawings) {
          winnerUid = winners.reduce((bestUid, uid) => {
            const g1 = (drawings[uid]?.guessedBy?.length || 0);
            const g2 = (drawings[bestUid]?.guessedBy?.length || 0);
            return g1 > g2 ? uid : bestUid;
          }, winners[0]);
        }
        await updateDoc(doc(db, "rooms", room), { winner: { uid: winnerUid }, phase: "winner" });
      };
      // Voting window: 15s
      timeoutId = setTimeout(winnerTimeout, 15000);
      return () => clearTimeout(timeoutId);
    }
  }, [phase, user, room, players, votingOpen, votes, drawings]);

  // === Main render logic ===
  // Step 1: Username login
  if (!user) {
    return (
      <div className="App">
        <header className="App-header">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
          </button>
          <div style={{ maxWidth: 350, margin: "0 auto", borderRadius: 16, background: "#fff", boxShadow: "0 1px 16px 2px #eee", padding: 16 }}>
            <img src="https://img.icons8.com/fluency/96/sketchbook.png" alt="sketch icon" style={{ marginBottom: 8 }} />
            <h1 style={{ color: gameTheme.primary }}>Doodle Finder</h1>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
              placeholder="Enter username"
              style={{ fontSize: 20, padding: 7, marginBottom: 12, borderRadius: 7, border: '1.5px solid #b9b9b9' }}
              maxLength={16}
            />
            <button onClick={handleLogin} className="btn-large" style={{ marginTop: 12, width: 120 }}>
              Join game
            </button>
            {authError && <div style={{ color: "#e33", marginTop: 10 }}>{authError}</div>}
          </div>
        </header>
      </div>
    );
  }

  // Step 2: Join/choose room
  if (!room) {
    return (
      <div className="App" style={{ minHeight: '100vh', background: "#fcfcfc" }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <Lobby username={username} setUsername={setUsername} onRoomSet={handleRoomSet} currentRoom={room} rooms={rooms} />
      </div>
    );
  }

  // Step 3: Game phase UI
  return (
    <div className="App" style={{ minHeight: '100vh', padding: 0, background: "#f8fbff" }}>
      <header className="App-header" style={{ padding: 0, minHeight: "calc(100vh - 40px)" }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <div style={{ minHeight: 52, width: "100%", background: gameTheme.primary, color: "#fff", display: "flex", alignItems: "center", fontSize: 25, fontWeight: 700, justifyContent: "space-between", padding: "0 18px", borderRadius: "0 0 18px 18px" }}>
          <span>✏️ Doodle Finder</span>
          <span style={{ fontWeight: 400, fontSize: 17 }}>Room: <b>{room}</b></span>
          <span style={{ fontWeight: 400, fontSize: 17, color: "#fff" }}>{username}</span>
        </div>
        {phase === 'lobby' || phase === 'spin' ? (
          <>
            <div style={{ marginTop: 22 }}>
              <SpinningWheel prompt={prompt} spinning={spinning} onSpin={handleSpinWheel} spinningPrompt={spinningPrompt} />
              <div style={{ marginTop: 48 }}>
                <div style={{ color: "#444", fontWeight: 500, marginBottom: 8 }}>Players:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                  {Object.entries(players).map(([uid, info]) => (
                    <span key={uid} style={{
                      background: "#f2fcff", color: gameTheme.primary, fontWeight: 600, borderRadius: 18,
                      padding: "7px 13px", fontSize: 17, border: `1.5px solid ${gameTheme.primary}`
                    }}>
                      {info.username || uid}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 30, fontSize: 16 }}>
                Game starts when you spin the wheel!
              </div>
            </div>
          </>
        ) : null}
        {phase === 'draw' ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "#222", fontWeight: 700, fontSize: 24, margin: "8px 0" }}>
              Prompt: <span style={{ color: gameTheme.primary }}>{prompt}</span>
            </div>
            <TimerBar totalTime={30} timeLeft={timeLeft} />
            <div>
              <DrawingCanvas onFinishDrawing={handleSubmitDrawing} disabled={!!drawings[user.uid]} timeLeft={timeLeft} />
            </div>
            {!!drawings[user.uid] && (
              <div style={{ color: gameTheme.primary, marginTop: 18, fontWeight: 700 }}>Waiting for others to finish...</div>
            )}
          </div>
        ) : null}
        {(phase === 'guess' || phase === 'vote' || phase === 'winner') && (
          <div style={{ marginTop: 12 }}>
            <SubmissionsPhase
              drawings={drawings}
              guesses={guesses}
              currentUser={user}
              onSubmitGuess={handleSubmitGuess}
              onVote={handleVote}
              phase={phase}
              votedFor={votedFor}
              votingOpen={votingOpen}
              winner={winner}
              players={players}
            />
          </div>
        )}
        {phase === 'winner' && (
          <div>
            <button className="btn-large" style={{ margin: "24px auto" }} onClick={handlePlayAgain}>
              Play Again
            </button>
          </div>
        )}
        <button
          onClick={() => {
            signOut(auth);
            setRoom('');
            setPhase('lobby');
            setPrompt('');
            setWinner(null);
            setDrawings({});
            setGuesses({});
            setVotes({});
            setVotedFor('');
            setPlayers({});
          }}
          style={{
            margin: "32px auto 8px", display: "block", background: "#eee",
            color: "#d55", border: "1px solid #fff",
            borderRadius: 9, fontSize: 14, padding: "8px 18px"
          }}>
          Leave / Sign Out
        </button>
        <div style={{ margin: "1rem 0", fontSize: "12px", color: "#666" }}>
          &copy; {new Date().getFullYear()} Doodle Finder. Powered by Firebase + IMGBB.
        </div>
      </header>
    </div>
  );
}

export default App;
