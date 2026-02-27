import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const token = localStorage.getItem('token');

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-50 relative flex">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-baknus-500/10 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-baknus-600/10 blur-[100px] pointer-events-none"></div>

      <div className="w-full h-full z-10">
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
          <Route path="/*" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
