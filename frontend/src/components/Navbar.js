import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sun, Moon, LogOut, Camera, User, Menu, ArrowLeft, Home } from "lucide-react";
import axios from "axios";
import { toast } from 'react-toastify';
import "./Navbar.css"; // Ensure CSS is tracked

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

function Navbar({ mode, setMode, backendStatus, theme, setTheme, onLogout, onToggleSidebar }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const fileInputRef = useRef(null);

  const userName = localStorage.getItem('userName') || 'Explorer';
  const userEmail = localStorage.getItem('userEmail') || '';
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profilePic') || null);

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image must be smaller than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        setProfilePic(base64String);
        localStorage.setItem('profilePic', base64String);
        try {
          await axios.put(`${API}/auth/profile-picture`, { email: userEmail, profile_picture: base64String });
          toast.success("Profile picture updated!");
        } catch (err) {
          toast.error("Failed to sync profile picture.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <nav className="navbar" data-testid="navbar">
      <div className="navbar-left">
        {mode && mode !== 'null' && (
          <button
            className="icon-btn mobile-hamburger-btn"
            onClick={onToggleSidebar}
            title="Toggle Menu"
          >
            <Menu size={24} />
          </button>
        )}

        <div
          className="navbar-brand-click"
          onClick={() => setMode(null)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          title="Return to Dashboard"
        >
          <Brain className="logo-icon" size={32} />
          <h1 className="logo-text" data-testid="app-title">KNOWLEDGE GRAPH AI</h1>
        </div>
      </div>

      <div className="navbar-right">
        <div className={`status-indicator ${backendStatus}`} title={backendStatus}>
          <span className="status-dot"></span>
        </div>


        {/* Profile Dropdown Component */}
        <div className="navbar-profile-container">
          <div
            className="navbar-avatar"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="navbar-avatar-img" />
            ) : (
              <div className="navbar-avatar-fallback">
                {getInitials(userName)}
              </div>
            )}
          </div>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="navbar-profile-menu card-glass"
              >
                <div className="profile-menu-header">
                  <div className="profile-menu-avatar-wrapper" onClick={() => fileInputRef.current?.click()}>
                    {profilePic ? (
                      <img src={profilePic} alt="Profile" className="profile-menu-img" />
                    ) : (
                      <div className="profile-menu-fallback">{getInitials(userName)}</div>
                    )}
                    <div className="profile-menu-overlay"><Camera size={14} /></div>
                  </div>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={handleImageUpload} />

                  <div className="profile-menu-info">
                    <h4>{userName}</h4>
                    <p>{userEmail}</p>
                  </div>
                </div>

                <div className="profile-menu-divider"></div>

                <button className="profile-menu-logout" onClick={() => { setShowProfileMenu(false); onLogout(); }}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}

export default React.memo(Navbar);
