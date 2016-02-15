var hue = require('node-hue-api'),
    ColorHelper = require('./colorHelper'),
    HueApi = hue.HueApi,
    lightState = hue.lightState,
    bridgeIP, username;

var argCount = process.argv.length;
for (var i = 0; i < argCount; i++) {
  var arg = process.argv[i];
  if (arg === '-b' && i + 1 < argCount) {
    bridgeIP = process.argv[i + 1];
  } else if (arg === '-u' && i + 1 < argCount) {
    username = process.argv[i + 1];
  }
}
if (typeof bridgeIP === 'undefined') {
  console.error('Provide a Hue bridge IP address with -b flag.');
  console.log('Example: node app.js -b 192.168.1.100');
  process.exit(1);
}
if (typeof username === 'undefined') {
  console.error('Provide a Hue bridge user with -u flag.');
  console.log('Example: node app.js -u 123abc');
  process.exit(1);
}
console.log('Connecting to bridge ' + bridgeIP + ' as user ' + username);

var api = new HueApi(bridgeIP, username);

var displayError = function(err) {
  console.error(err);
};
var displayLight = function(light) {
  var state = light.state;
  console.log("\t" + light.name + ' model ' + light.modelid);
  if (state.on) {
    console.log("\tx: " + state.xy[0] + ', y: ' + state.xy[1] +
                ', brightness: ' + state.bri);
  } else {
    console.log('\toff');
  }
};
var getLightStatus = function(lightID) {
  api.lightStatus(lightID).
      then(function(result) {
        console.log("\nLight #" + lightID);
        displayLight(result);
      }).fail(displayError).done();
};
var displayGroup = function(group) {
  console.log("\t# lights: " + group.lights.length);
  for (var i = 0; i < group.lights.length; i++) {
    getLightStatus(group.lights[i]);
  }
};
var displayBridge = function(bridge) {
  console.log('Bridge "' + bridge.name + '"');
  console.log("\tTime: " + bridge.localtime);
  console.log("\tAPI version: " + bridge.apiversion);
  api.getGroup('0').then(displayGroup).done();
};
api.config().then(displayBridge).done();

// var lightID = 11;

// var displayLightState = function(result) {
//   console.log(result);
// };
// var displayStatus = function(status) {
//     console.log("Light status:\n" +
//                 JSON.stringify(status, null, 2));
// };
// api.lightStatus(lightID).then(displayStatus).done();

// // var redX = 0.6417, redY = 0.304;
// // var blueX = 0.168, blueY = 0.041;
// // // var state = lightState.create().on().xy(redX, redY);
// // var state = lightState.create().on().effect('none');

// // api.setLightState(lightID, state).
// //     then(displayLightState).fail(displayError).done();
