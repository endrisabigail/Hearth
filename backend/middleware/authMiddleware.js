import jwt from 'jsonwebtoken';
//gate of protection
const protect = (req, res, next) => {
    // Get the token from the request header
    const token = req.header('x-auth-token');
    //if no token, deny access
    if (!token) {
        return res.status(401).json({msg: "No token, authorization denied."});
    }
    //otherwise, verify the token
    try { 
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token using the secret key
        // add user id to request so who is logged in can be identified
        req.user = decoded.id;
        next(); // express, move to next code
        
    } catch (err){
        res.status(401).json({msg: 'Token is not valid.'}); // If the token is invalid, return a 401 Unauthorized response with an error message
    }
};

export default protect; 
    