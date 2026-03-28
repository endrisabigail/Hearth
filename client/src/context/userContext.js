import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
// create "station" aka the context
export const UserContext = createContext();

//create the "broadcast tower" aka the provider
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null); // store user data
  const [loading, setLoading] = useState(true); // check if user data is still being fetched

  // reach out to backend to check who is logged in
  const loadUser = async () => {
    const token = localStorage.getItem('token'); // get token from local storage
    if (!token) {
        setLoading(false); // if no token, we're done loading
        return;
    }
    try { //send a request to the backend to get user data 
        const res = axios.get('http://localhost:5000/api/auth/me', {
            headers: { 'x-auth-token': token } //send token in headers for authentication
        });
        setUser(res.data); // store user data in state (points/badges)
    } catch (err){
        console.error('Failed to load user:', err);
        localStorage.removeItem('token'); // if token is invalid, remove it
    }
    setLoading(false); // Once the check is done, set loading to false
    };
    // runs loadUser automatically when app starts
    useEffect(() => {
        loadUser();
    }, []);
    //update UI automatically when quest is done
    const updateProgress = (newData) => {
        setUser(prev => // take previous data
            ({ ...prev, // keep name and email the same
                points: newData.points, // update points
                badges: newData.badges // update badges
            }));
    };
    // the value provided to the rest of app
    return (
        <UserContext.Provider value={{ user, loading, updateProgress }}>
            {children}
        </UserContext.Provider>
    );

    }