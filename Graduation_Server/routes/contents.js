/*jshint esversion: 6 */
var express = require('express');
var fs = require('fs')

var mysql = require('mysql');
var db = require('../config/db.js');
var conn = mysql.createConnection(db);

var multer = require('multer');
var router = express.Router();
var utils = require('../utils.js')

var _storage = multer.diskStorage({
    destination: function(req, file, cb) {cb(null, 'files/images')},
    filename: function(req, file, cb) {cb(null, req.authorizationId + "-" + req.params.create_at + ".png");}
});
const TOKEN_KEY = "jwhtoken"

//모든 글 보기
router.get('/',(req,res)=>{
  utils.dbConnect(res).then((connection)=>{
    utils.query(connection,res,
    `SELECT * FROM contents`).then((result)=>{
      if(result.length === 0){
        connection.release()
        res.status(200).json(
          {
            meta : {
              code : 200,
              message : "글이 없음"
            }
          }
        )
      }else{
        connection.release()
        res.status(200).json(utils.toRes(utils.SUCCESS,{
          data : result
        }))
      }
    })
  })
})

//user_id = id인 값의 모든 글 보기
router.get('/my', function(req, res) {
    var user_id = req.authorizationId;
    utils.dbConnect(res).then((connection)=>{
      utils.query(connection,res,
      `SELECT c.*, u.user_name
       FROM contents c, user_info u
       WHERE c.user_id = ? && c.user_id = u.user_id
       ORDER BY c.create_at DESC`,[user_id])
       .then((result)=>{
         if(result.length === 0 ){
           res.status(200).json(
             {
               meta : {
                 code : 200,
                 message : "제가 쓴 글이 없습니다"
               }
             }
           )
         }else{
           res.status(200).json(utils.toRes(utils.SUCCESS,
             {
                  myContentsCount : result.length,
                  myContents: result
             }
           ))
         }
       })
    })
  })



// get 반경 200미터 유저들의 게시물 30개 검색
router.get('/around', (req, res) => {
    var user_id = req.authorizationId
    var latitude = req.query.lat;
    var longitude = req.query.lng;
    //페이지 카운트 해야함???

    utils.dbConnect(res).then((connection)=>{
      //위치 업데이트
      utils.query(connection,res,
      'UPDATE user_posi SET lat = ? , lng = ? WHERE user_id = ?',[latitude,longitude,user_id])
      .then((updateresult)=>{
        utils.query(connection,res,
        `SELECT c.*, u.user_name, u.profile_dir, ifnull(cl.is_like,0), is_like
         FROM (SELECT user_id FROM user_posi WHERE user_id != ? AND ( 6371 * acos( cos( radians(?) ) * cos( radians( lat ) ) * cos( radians( lng ) - radians(?) ) + sin( radians(?) ) * sin( radians( lat ) ) ) )< 1) up,
              user_info u, contents c
         LEFT OUTER JOIN content_like cl
         ON cl.user_id = ? && cl.content_id = c.content_id
         WHERE c.user_id = up.user_id AND c.user_id = u.user_id AND c.user_id != ?
         ORDER BY c.create_at DESC, c.content_id DESC LIMIT 0, 30`,
         [user_id, latitude, longitude, latitude, user_id, user_id])
         .then(aroundResult=>{
           if(aroundResult.length === 0){
             res.status(201).json({
               meta : {
                 code : 201,
                 message : "주변에 글 올린 사람이 없음"
               }
             })
           }else{
             res.status(200).json(utils.toRes(utils.SUCCESS,{
               data : aroundResult
             }))
           }
           connection.release()
         })
      })
    })
});



//user_id = id 글 쓰기
var upload = multer({storage: _storage}).single('content_image');
router.post('/', function(req, res) {
        var user_id = req.authorizationId;
        var create_at = utils.getTimeStamp();
        var crdate = utils.getTimeDate();
        var crtime = utils.getTimeTime();
        var trimCreateAt = crdate + crtime;
        req.params.create_at = trimCreateAt;
        // 동기식으로 업로드 후 쿼리 실행하는방법?
          upload(req, res, (err) => {
          var content_text = req.body.content_text;
          var share_range = req.body.share_range;
          var location_range = req.body.location_range;
          var has_image = req.body.has_image;
          var image_dir = '0';
          var lng = req.body.lng;
          var lat = req.body.lat;

	console.log(user_id,content_text, share_range, location_range, has_image,image_dir, lng,lat);

          if (has_image == 1) {
              image_dir = 'http://13.124.115.238:8080/image/' + user_id + "-" + trimCreateAt + ".png";
          }

      utils.dbConnect(res).then((connection)=>{
        utils.query(connection,res,
        `UPDATE user_posi SET lat=?,lng=? WHERE user_id =?`,[lat,lng,user_id])
        .then((updateRes)=>{
          utils.query(connection,res,
          `INSERT INTO contents(user_id,content_text,create_at,share_range,location_range,image_dir) VALUES (?, ?, ?, ?, ?, ?)`,
          [user_id, content_text, create_at, share_range, location_range, image_dir]).then((insertRes)=>{
            return res.status(200).json(utils.toRes(utils.SUCCESS,
              {
              update : updateRes,
              insert : insertRes
              }
          ))
          })
        })
      })
    });
});

//글삭제
router.delete('/:content_id',(req,res)=>{
  var content_id = req.params.content_id;
  var user_id = req.authorizationId;
  utils.dbConnect(res).then((connection)=>{
    utils.query(connection,res,`DELETE FROM contents WHERE content_id = ? AND user_id = ?`,
    [content_id, user_id])
    .then((result)=>{
      res.status(200).json(utils.toRes(utils.SUCCESS,{
        data : result
      }));
      connection.release();
    })
  })
})

module.exports = router;

// //글 수정
// router.put('/:contents_id', (req, res) => {
//     var user_id = req.authorizationId
//     var contents_id = req.params.contents_id;
//     var contents_text = req.body.contents_text;
//     var share_range = req.body.share_range;
//     var location_range = req.body.location_range;
//     var update_date = utils.getTimeStamp();
//     req.params.create_at = update_date;
//     var sql = 'UPDATE contents SET contents_text = ?, share_range = ?, location_range = ?, update_date = ?' +
//         'WHERE contents_id = ?';
//
//     conn.query(sql, [contents_text, share_range, location_range, update_date, contents_id], (err, row) => {
//         if (err) {
//             console.log(err);
//         } else {
//             res.status(200).send('success');
//         }
//     })
// })







//좋아요 버튼
// router.post('/like', (req, res) => {
//     var user_id = req.body.user_id;
//     var contents_id = req.body.content_id;
//     var is_like = req.is_like;
//     var sql;
//
//     if (is_like == 0) {
//         sql = 'INSERT INTO content_like(user_id,content_id,is_like) VALUES(?,?,?)';
//         conn.query(sql, [user_id, content_id, is_like], (err, rows) => {
//             if (err) {
//                 console.log(err)
//             } else {
//                 res.status(200).send('success');
//             }
//         })
//     } else {
//         sql = 'DELETE content_like where content_id = ?, user_id = ?';
//         conn.query(sql, [content_id, user_id], (err, rows) => {
//             if (err) {
//                 console.log(err);
//             } else {
//                 res.status(200).send('delete');
//             }
//         })
//     }
// })



// router.get('/all', (req, res) => {
//
//     var user_id = req.query.user_id;
//     var sql = 'SELECT c.*, u.user_name' +
//         ' FROM user_info u,contents c' +
//         ' WHERE u.user_id=c.user_id'
//
//     conn.query(sql, (err, rows) => {
//         if (err) {
//             console.log(err);
//         } else {
//             res.json(rows);
//         }
//     })
// })

// router.get('/', (req, res) => {
//
//     var user_id = req.query.user_id;
//     console.log(user_id);
//     var sql = 'SELECT c.*, u.user_name, ifnull(cl.is_like,0) as is_like, u.profile_dir' +
//         ' FROM user_info u,contents c' +
//         ' LEFT OUTER JOIN content_like cl' +
//         ' ON cl.content_id = c.content_id && cl.user_id = ?' +
//         ' WHERE u.user_id=c.user_id'
//
//     conn.query(sql, [user_id], (err, rows) => {
//         if (err) {
//             console.log(err);
//         } else {
//             res.json(rows);
//         }
//     })
// })

// router.get('/never', function(req, res) {
//
//     var user_id = req.query.id;
//     var latitude = req.query.lat;
//     var longitude = req.query.lng;
//
//     console.log('user id = ' + user_id);
//     console.log('lat = ' + latitude + ', lng = ' + longitude);
//     var sql = 'SELECT user_id ' +
//         'FROM user_posi ' +
//         'WHERE user_id != ? ' +
//         'AND ( 6371 * acos( cos( radians(?) ) * cos( radians( lat ) ) * cos( radians( lng ) - radians(?) ) + sin( radians(?) ) * sin( radians( lat ) ) ) )< 0.5;'
//     //  +      'ORDER BY distance';
//
//     conn.query(sql, [user_id, latitude, longitude, latitude], (err, rows) => {
//         if (err) {
//             console.log(err);
//         } else {
//             res.json(rows);
//         }
//     })
// })
