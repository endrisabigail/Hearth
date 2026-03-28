import React, { use, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
function forgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            await axios.post('http://localhost:5000/api/forgot-password', { email });
            setError('If an account with that email exists, a reset link has been sent.');
            navigate('/login');
        } catch (err) {
            setError('Failed to send reset link. Please try again later.');
            setLoading(false);            
        }
    }
    return (
        <div className="forgot-password-container">
            <form onSubmit={handleForgotPassword} className="forgot-password-form">
                <h2> Forgot Password </h2>
                <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
                {error && <p className="error">{error}</p>}
                <button type="submit">Send Reset Link</button>
            </form>
            <p>
                Remembered your password? <Link to="/login">Login</Link>
            </p>
        </div>
    );
}
export default forgotPassword;