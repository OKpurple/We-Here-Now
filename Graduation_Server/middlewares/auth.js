var jwt = require('jsonwebtoken');
let TOKEN_KEY = 'jwhtoken'
var authMiddleware = (req,res,next) => {
  var token = req.headers.authorization;


  if ( req.path === '/login'){
      return next();
  }

  if(!token){
    return res.status(403).json({
           success: false,
           message: 'not logged in'
       })
  }

  const onError = (error) => {
        res.status(403).json({
            code : 403,
            success: false,
            message: error.message
        })
    }


  const p = new Promise((resolve, reject)=>{
    jwt.verify(token, TOKEN_KEY,(err,decoded)=>{
      if(err){
        reject(err);
      }else{
        resolve(decoded);
      }
    })
  }).then((decoded)=>{
     req.authorizationId = decoded.user_id
    next();
  }).catch(onError);


}

module.exports = authMiddleware;
