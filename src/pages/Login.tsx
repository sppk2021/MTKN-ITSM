import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { motion } from "motion/react";
import { Shield, Mail, Lock, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Login({ appLogo }: { appLogo?: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setLoginError("Invalid email or password");
      } else {
        setLoginError("Failed to sign in. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4">
      <motion.div
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white dark:bg-slate-800 p-8 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl text-center max-w-md w-full"
      >
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg rotate-3 group hover:rotate-0 transition-transform overflow-hidden">
          {appLogo ? (
            <img src={appLogo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Shield className="w-8 h-8 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">MTKN ITSM</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Secure Enterprise IT Operations Portal</p>
        
        <form onSubmit={handleCustomLogin} className="space-y-4 mb-6 text-left">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Work Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                placeholder="admin@mtkn.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 ml-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          {loginError && <p className="text-red-500 dark:text-red-400 text-[10px] bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/50">{loginError}</p>}
          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-lg shadow-sm text-sm font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            {isLoggingIn ? "Signing in..." : <><LogIn className="w-4 h-4" /> Sign In</>}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 font-medium font-sans">
          Developed by <span className="text-slate-700 dark:text-slate-300 font-semibold">Saw Pyae Phyo Kyaw</span>
        </div>
      </motion.div>
    </div>
  );
}
