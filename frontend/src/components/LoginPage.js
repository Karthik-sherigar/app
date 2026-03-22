import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Network, Search, BrainCircuit, Shield, Chrome, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './LoginPage.css';

const GOOGLE_CLIENT_ID = "171238226547-gq0n9m4ro79nq5p0nor33r9d506o8b7s.apps.googleusercontent.com";
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8015";
const API = `${BACKEND_URL}/api/auth`;

const LoginContent = ({ onLogin }) => {
    const navigate = useNavigate();
    const [view, setView] = useState('login'); // 'login', 'register'
    const [isLoading, setIsLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [backendStatus, setBackendStatus] = useState("loading");
    
    // NEW STATES
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                await axios.get(`${BACKEND_URL}/api/health`);
                setBackendStatus("connected");
            } catch (err) {
                setBackendStatus("error");
            }
        };
        checkHealth();
    }, []);

    // OTP Timer Logic
    useEffect(() => {
        let interval;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);
    
    // Form States
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        otp: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const res = await axios.post(`${API}/google`, { access_token: tokenResponse.access_token });
                toast.success(res.data.message || "Successfully authenticated with Google!");
                localStorage.setItem("userEmail", res.data.email);
                localStorage.setItem("userName", res.data.full_name);
                if (res.data.profile_picture) {
                    localStorage.setItem("profilePic", res.data.profile_picture);
                }
                if (onLogin) onLogin();
                navigate("/"); 
            } catch (err) {
                toast.error(err.response?.data?.detail || "Google Login Failed on Server.");
            }
        },
        onError: () => {
            toast.error("Google Login popup closed or failed!");
        }
    });

    const handleSendOTP = async () => {
        if (!formData.email) {
            toast.error("Please enter your email first.");
            return;
        }
        setIsLoading(true);
        try {
            const res = await axios.post(`${API}/send-otp`, { email: formData.email });
            toast.success(res.data.message || "OTP sent successfully to your email!");
            setOtpSent(true);
            setResendTimer(30); // Start 30s countdown
        } catch (error) {
            const errorMsg = error.response?.data?.detail || "Failed to send OTP.";
            toast.error(errorMsg, {
                autoClose: 5000, // Show for longer
            });
            if (errorMsg.includes("exists")) {
                toast.info("If you already have an account, try logging in instead.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (view === 'login') {
                const res = await axios.post(`${API}/login`, { 
                    email: formData.email, 
                    password: formData.password 
                });
                toast.success(res.data.message || "Welcome back!");
                localStorage.setItem("userEmail", res.data.email);
                localStorage.setItem("userName", res.data.full_name);
                if (res.data.profile_picture) {
                    localStorage.setItem("profilePic", res.data.profile_picture);
                }
                if (onLogin) onLogin();
                navigate("/");
            } else if (view === 'register') {
                // Validation
                if (!otpSent) {
                    toast.error("Please verify your email using OTP.");
                    setIsLoading(false);
                    return;
                }
                if (!formData.otp) {
                    toast.error("Please enter the OTP.");
                    setIsLoading(false);
                    return;
                }
                if (formData.password !== formData.confirmPassword) {
                    toast.error("Passwords do not match!");
                    setIsLoading(false);
                    return;
                }
                
                const res = await axios.post(`${API}/register`, {
                    full_name: formData.fullName,
                    email: formData.email,
                    password: formData.password,
                    otp: formData.otp
                });

                toast.success(res.data.message || "Account created successfully! Please login.");
                // Switch to login view safely
                setView('login');
                setOtpSent(false);
                setFormData({...formData, password: '', confirmPassword: '', otp: ''});
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-layout">
            
            {/* System Status Indicator - Top Right */}
            <div className={`login-status-wrap ${backendStatus}`} title={backendStatus}>
                <span className="status-dot"></span>
                <span className="status-text">{backendStatus === "connected" ? "Systems Online" : backendStatus === "error" ? "Connecting..." : "Checking Systems..."}</span>
            </div>

            {/* LEFT PANEL - FORM */}
            <div className="auth-panel auth-left">
                <div className="auth-form-container">
                    
                    {/* Brand */}
                    <div className="auth-brand">
                        <div className="auth-logo-box">
                            <BrainCircuit size={20} className="auth-logo-icon" />
                        </div>
                        <span className="auth-brand-name">KnowledgeGraph AI</span>
                    </div>

                    {/* Header */}
                    <div className="auth-header">
                        <h2>{view === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
                        <p>{view === 'login' 
                            ? 'Welcome back to the future of structured data and intelligence.' 
                            : 'Join the future of structured data and intelligence.'}</p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <AnimatePresence mode='wait'>
                            {view === 'register' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="form-group"
                                >
                                    <label>Full Name</label>
                                    <input 
                                        type="text" name="fullName" placeholder="John Doe" 
                                        value={formData.fullName} onChange={handleChange} required={view === 'register'} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="form-group">
                            <label>Email Address</label>
                            {view === 'register' ? (
                                <div className="input-with-button">
                                    <input 
                                        type="email" name="email" placeholder="name@company.com" 
                                        value={formData.email} onChange={handleChange} required 
                                    />
                                    <button 
                                        type="button" 
                                        className="btn-secondary outline"
                                        onClick={handleSendOTP}
                                        disabled={isLoading || resendTimer > 0}
                                    >
                                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : (otpSent ? 'Resend OTP' : 'Send OTP')}
                                    </button>
                                </div>
                            ) : (
                                <input 
                                    type="email" name="email" placeholder="name@company.com" 
                                    value={formData.email} onChange={handleChange} required 
                                />
                            )}
                        </div>

                        <AnimatePresence mode='wait'>
                            {view === 'register' && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="form-group"
                                >
                                    <label>OTP Verification</label>
                                    <input 
                                        type="text" name="otp" placeholder="6-digit code" 
                                        value={formData.otp} onChange={handleChange} required={view === 'register'} 
                                        maxLength={6}
                                        className="otp-clean-input"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {view === 'register' ? (
                            <div className="form-row">
                                <div className="form-group half">
                                    <label>Password</label>
                                    <div className="input-with-icon">
                                        <input 
                                            type={showPassword ? "text" : "password"} 
                                            name="password" placeholder="••••••••" 
                                            value={formData.password} onChange={handleChange} required 
                                        />
                                        <button 
                                            type="button" 
                                            className="icon-toggle"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group half">
                                    <label>Confirm Password</label>
                                    <div className="input-with-icon">
                                        <input 
                                            type={showConfirmPassword ? "text" : "password"} 
                                            name="confirmPassword" placeholder="••••••••" 
                                            value={formData.confirmPassword} onChange={handleChange} required 
                                        />
                                        <button 
                                            type="button" 
                                            className="icon-toggle"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="form-group">
                                <label>Password</label>
                                <div className="input-with-icon">
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        name="password" placeholder="••••••••" 
                                        value={formData.password} onChange={handleChange} required 
                                    />
                                    <button 
                                        type="button" 
                                        className="icon-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        )}

                        <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
                            {isLoading ? <div className="loader-spinner"></div> : (view === 'login' ? 'Sign In' : 'Create Account')}
                        </button>
                        
                        <div className="auth-divider">
                            <span>OR</span>
                        </div>

                        <button 
                            type="button" 
                            className="btn-google" 
                            onClick={() => handleGoogleLogin()}
                            disabled={isLoading}
                        >
                            <Chrome size={18} />
                            <span>Continue with Google</span>
                        </button>
                    </form>

                    <div className="auth-footer-text">
                        {view === 'login' ? (
                            <p>Don't have an account? <span onClick={() => {setView('register'); setOtpSent(false); setFormData({...formData, otp: ''})}}>Sign Up</span></p>
                        ) : (
                            <p>Already have an account? <span onClick={() => setView('login')}>Sign In</span></p>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL - GRAPHICS & INFO */}
            <div className="auth-panel auth-right">
                <div className="auth-right-grid"></div>
                <div className="auth-right-content">
                    
                    <div className="hero-graphic">
                        <div className="orb-bg"></div>
                        <Network size={80} className="hero-icon" />
                        <div className="badge-float">
                            <Search size={16} />
                        </div>
                    </div>

                    <div className="hero-text-block">
                        <h1>Visualize Connections with</h1>
                        <h1 className="hero-highlight">Knowledge Graph AI</h1>
                        <p>
                            Transform unstructured data into a powerful network of insights. 
                            Our AI automatically maps entities and relationships to help you see the bigger picture.
                        </p>
                    </div>

                    <div className="feature-cards">
                        <div className="feature-card">
                            <div className="feature-card-icon"><Search size={18} /></div>
                            <h3>Vector Search</h3>
                            <p>Semantic retrieval for deep context understanding.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-card-icon"><Network size={18} /></div>
                            <h3>Graph Analytics</h3>
                            <p>Identify patterns and bottlenecks in real-time.</p>
                        </div>
                    </div>

                    <div className="auth-page-footer">
                        <span>© 2026 KnowledgeGraph AI Inc.</span>
                        <div className="footer-links">
                            <Link to="/privacy">Privacy</Link>
                            <Link to="/terms">Terms</Link>
                            <Link to="/security">Security</Link>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

const LoginPage = ({ onLogin }) => (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <LoginContent onLogin={onLogin} />
    </GoogleOAuthProvider>
);

export default LoginPage;
