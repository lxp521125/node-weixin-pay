'use strict';

/**
 * For Weixin Pay ver 3.3.7
 * @type {*|exports|module.exports}
 */

var _ = require('lodash');
var restful = require("node-weixin-request");
var util = require("node-weixin-util");
var v = require('node-form-validator');
var errors = require('web-errors').errors;
var crypto = require('crypto');

var pay = {
  /**
   * Handler for weixin server response
   *
   * @param cb
   * @param error
   * @param json
   * @param validate
   * @returns {*}
   */
  handle: function (app, merchant, json, resultValidator, cb) {
    var returnCode = json.return_code;
    var returnMsg = json.return_msg;
    var error = {};

    if (returnCode === 'SUCCESS') {
      var vError = this.validate(app, merchant, json);
      if (true !== vError) {
        return cb(true);
      }

      //是否还要验证数据
      if (resultValidator === null) {
        return cb(false, null, json);
      }
      var resultCode = json.result_code;
      if (resultCode === 'SUCCESS') {
        if (!v.validate(resultValidator, json, error)) {
          cb(true);
          return;
        }
        var result = v.json.extract(json, resultValidator);
        cb(false, result, json);
      }
    }
    cb(true, returnMsg);
  },

  /**
   * Basic http request for pay apis
   *
   * @param url                 Requesting url
   * @param data                Data to be sent
   * @param sendConfig          Sending data validation configuration
   * @param receiveConfig       Receiving data validation configuration
   * @param certificate         Certificate from Tencent Pay
   * @param cb                  Callback Function
   */
  request: function (url, data, sendConfig, receiveConfig, certificate, cb) {
    var error = {};

    //Validate Sending Data
    if (!v.validate(sendConfig, data, error)) {
      cb(true, error);
      return;
    }

    var params = _.clone(data);
    params = this.prepare(params);
    params.sign = util.sign(params);
    var xml = util.toXml(params);
    var pay = this;
    restful.xmlssl(url, xml, certificate, function (error, json) {
      pay.handle(cb, error, json, receiveConfig);
    });
  },

  /**
   * Prepare data with normal fields
   *
   * @param data
   * @param app
   * @param merchant
   * @param device
   * @returns {*}
   */
  prepare: function (data, app, merchant, device) {
    data.appid = app.id;
    data.mch_id = merchant.id;
    if (device) {
      data.device_info = device.info;
    }
    data.nonce_str = util.getNonce();
    return data;
  },


  /**
   * Sign all data with merchant key
   * @param merchant
   * @param params
   * @returns {string}
   */
  sign: function (merchant, params) {
    var temp = util.marshall(params);
    temp += '&key=' + merchant.key;
    var crypt = crypto.createHash('md5');
    crypt.update(temp);
    return crypt.digest('hex').toUpperCase();
  },
  validate: function (data, app, merchant) {
    var config = require('./conf/validation');
    var conf = config.auth.header;
    var error = {};

    if (!v.validate(conf, data, error)) {
      return errors.ERROR;
    }
    if (data.appid !== app.id) {
      return errors.APP_ID_ERROR;
    }
    if (data.mch_id !== merchant.id) {
      return errors.MERCHANT_ID_ERROR;
    }
    return true;
  },
  callback: require('./lib/callback'),
  api: require('./lib/api')
};


module.exports = pay;

