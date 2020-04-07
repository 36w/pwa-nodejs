// 使用 express 框架
var app = require('express')();
var express = require("express");
var server = require('http').Server(app);

var UUID = require('uuid');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://127.0.0.1:27017/";

const fs = require('fs');

// 引入 socket.io
var io = require('socket.io')(server);
// 监听 8081 端口
server.listen(8081);
// 开启静态资源服务
app.use(express.static("./static"));

// io 各种事件
io.on('connection', function (socket) {
    socket.on('login', function (data) {
        console.log(data);
        if (data.userName && data.password) {
            // socket.emit('loginResult', { msg: '登陆成功',data:{userId:1,userName:'xulei',creationTime:'2020-03-26'} });
            MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
                if (err) throw err;
                var dbo = db.db("story");
                var whereStr = { userName: data.userName, password: data.password };  // 查询条件
                dbo.collection("user").find(whereStr).toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    if (result.length) {
                        socket.emit('loginResult', { code: '200', msg: '登陆成功', data: { result } });
                    } else {
                        socket.emit('loginResult', { code: '-200', msg: '登陆失败' });
                    }
                    db.close();
                });
            });
        }
        else {
            socket.emit('loginResult', { code: '-200', msg: '登陆失败' });
        }
    });
    socket.on('register', function (data) {
        console.log(data);
        var ID = UUID.v1();
        if (data.userName && data.password) {
            MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
                if (err) throw err;
                var dbo = db.db("story");
                var myobj = { userId: ID, userName: data.userName, password: data.password, creationTime: data.creationTime };
                var whereStr = { userName: data.userName };
                dbo.collection("user").find(whereStr).toArray(function (err, result) {
                    if (err) throw err;
                    console.log(result);
                    if (result.length) {
                        socket.emit('registerResult', { code: '-200', msg: '注册失败，已有该用户名' });
                    } else {
                        // socket.emit('registerResult', { code:'200',msg: '注册成功' });
                        dbo.collection("user").insertOne(myobj, function (err, res) {
                            if (err) throw err;
                            console.log(res);
                            socket.emit('registerResult', { code: '200', msg: '注册成功', data: { userId: ID, userName: data.userName, creationTime: data.creationTime } });
                            db.close();
                        });
                    }
                    db.close();
                });
            });
        }
        else {
            socket.emit('registerResult', { code: '-200', msg: '注册失败' });
        }
    });
    socket.on('storyType', function (data) {
        console.log(data);
        MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("story");
            dbo.collection("storyType").find({}).toArray(function (err, result) { // 返回集合中所有数据
                if (err) throw err;
                console.log(result);
                socket.emit('storyTypeResult', { code: '200', msg: '查询成功', data: result });
                db.close();
            });
        });
    });
    socket.on('storyList', function (data) {
        console.log(data);
        MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("story");

            var where_storyTypeId = []
            new Promise(
                function (resolve, reject) {
                    if (data.recommendType == 0) {
                        //按照按照自己的喜好来搜索
                        dbo.collection("likeDegree").find({ userId: data.userId, $or: [{ "likeId": "3" }, { "likeId": "4" }] }).toArray(function (err, result) { // 返回集合中所有数据
                            if (err) throw err;
                            var where_storyId = []
                            result.forEach(element => {
                                where_storyId.push({ storyId: element.storyId })
                            });
                            if(where_storyId.length>0){
                            dbo.collection("storyList").find({ $or: where_storyId }).toArray(function (err, result) { // 返回集合中所有数据
                                if (err) throw err;
                                result.forEach(element => {
                                    where_storyTypeId.push({ storyTypeId: element.storyTypeId })
                                });
                                resolve(data.userId)
                            });
                            }else{
                                dbo.collection("storyList").find({ }).toArray(function (err, result) { // 返回集合中所有数据
                                    if (err) throw err;
                                    result.forEach(element => {
                                        where_storyTypeId.push({ storyTypeId: element.storyTypeId })
                                    });
                                    resolve(data.userId)
                                });
                            }
                        });
                    } else {
                        resolve()
                    }
                }).then(
                    new Promise(function (resolve, reject) {
                        if(where_storyTypeId.length>0){
                            dbo.collection("storyList").find({ $or: where_storyTypeId }).sort({creationTime:-1}).toArray(function (err, result) { // 返回集合中所有数据
                                if (err) throw err;
                                resolve(result)
                            });
                        }else{
                            dbo.collection("storyList").find({}).sort({creationTime:-1}).toArray(function (err, result) { // 返回集合中所有数据
                                if (err) throw err;
                                resolve(result)
                            });
                        }
                    }
                    ).then(
                        function (resultdata) {
                            resultdata.forEach(dataelement => {
                                //查看自己的喜欢程度
                                dbo.collection("likeDegree").find({
                                    userId: data.userId,
                                    storyId: dataelement.storyId
                                }).toArray(function (err, result) { // 返回集合中所有数据
                                    if (err) throw err;
                                    var likeId = 0
                                    var likeTime = 0
                                    let j = 0
                                    result.forEach(element => {
                                        if (element.creationTime > likeTime) {
                                            likeTime = element.creationTime
                                            likeId = element.likeId
                                            dataelement.likeId = likeId
                                        }
                                    });
                                });
                            });
                            setTimeout(function () {
                                socket.emit('storyListResult', {
                                    code: '200',
                                    msg: '故事查询成功',
                                    data: resultdata
                                });
                                db.close();
                            },200)
                        }
                    )
                )
        });

    });
    socket.on('changeLike', function (data) {
        console.log(data.storyId);
        MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("story");
            var myobj = data;
            dbo.collection("likeDegree").insertOne(myobj, function (err, res) {
                if (err) throw err;
                socket.emit('changeLikeResult', { code: '200', msg: '修改成功' });
                db.close();
            });
        });
    });
    socket.on('uploadStory', function (data) {
        var ID = UUID.v1();
        // console.log(data);
        console.log(data.imgData.length, ID);
        //接收前台传过来的base64
        var imgData = data.imgData;
        var imgDataResult = [];
        //过滤data:URL
        let j = 0;
        let g = 0;
        for (var i = 0; i < data.imgData.length; i++) {
            var base64Data = imgData[i].replace(/^data:image\/\w+;base64,/, "");

            // let base64str = Buffer.from(bitmap, 'binary').toString('base64');//base64编码
            let dataBuffer = Buffer(base64Data, 'base64');//解码图片

            fs.writeFile(new Date().getTime() + ID + (j++) + ".png", dataBuffer, function (err) {
                if (err) {
                    socket.emit('uploadStoryResult', { err });
                } else {
                    // socket.emit('uploadStoryResult', { code:'200',msg: '图片保存成功' });
                    imgDataResult.push(new Date().getTime() + ID + (g++) + ".png");
                    console.log('imgDataResult:', imgDataResult);
                }
            });
        }
        setTimeout(function () {
            if (data.storyContent && data.imgData.length) {
                console.log('imgDataResult', imgDataResult);
                MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
                    if (err) throw err;
                    var dbo = db.db("story");
                    var myobj = { userId: data.userId, userName: data.userName, storyId: ID + new Date().getTime(), storyContent: data.storyContent, imgDatabase64: imgData, imgData: imgDataResult, likeId: data.likeId, likeName: data.likeName, storyTypeId: data.storyTypeId, storyTypeName: data.storyTypeName, creationTime: data.creationTime };
                    dbo.collection("storyList").insertOne(myobj, function (err, res) {
                        if (err) throw err;
                        console.log(res);
                        socket.emit('uploadStoryResult', {
                            code: '200',
                            msg: '故事保存成功'
                        });
                        db.close();
                    });
                });
            } else {
                socket.emit('uploadStoryResult', { code: '-200', msg: '请输入故事内容' });
            }
        }, 200);
    });
});
