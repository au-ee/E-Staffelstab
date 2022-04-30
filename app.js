/*
 * Copyright 2016 - 2017 Anton Tananaev (anton@traccar.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

if (!Array.prototype.find) {
  Object.defineProperty(Array.prototype, "find", {
    value: function(predicate) {
      var value;
      for (var i = 0; i < this.length; i++) {
        value = this[i];
        if (predicate.call(arguments[1], value, i, this)) {
          return value;
        }
      }
      return undefined;
    }
  });
}

var getQueryParameter = function(name) {
	return (window.location.search.match('[?&]' + name + '=([^&]*)') || [])[1];
};

var url = window.location.protocol + '//' + window.location.host;
var token = getQueryParameter('token');
token = '5ehkrIrmLV8J0oVSvOFJcY8TchroZyqsB';

var style = function (label) {
    return new ol.style.Style({
        image: new ol.style.Circle({
            fill: new ol.style.Fill({
                color: 'teal'
            }),
            stroke: new ol.style.Stroke({
                color: 'black',
                width: 2
            }),
            radius: 7
        }),
        text: new ol.style.Text({
            text: label,
            fill: new ol.style.Fill({
                color: 'black'
            }),
            stroke: new ol.style.Stroke({
                color: 'white',
                width: 2
            }),
            font: 'bold 12px sans-serif',
            offsetY: -16
        })
    });
};

var source = new ol.source.Vector();

var markers = {};

var vectorStyle = new ol.style.Style({
	stroke: new ol.style.Stroke({
		color: 'red',
		width: 8,
		opacity: 0.5
	})
});

var track = new ol.source.Vector({
      url: 'track.gpx',
      format: new ol.format.GPX()
  });

var map = new ol.Map({
    layers: [
        new ol.layer.Tile({
            source: new ol.source.OSM()
        }),
        new ol.layer.Vector({
            source: track,
            style: vectorStyle
        }),
        new ol.layer.Vector({
            source: source
        })
    ],
    target: 'map',
    view: new ol.View({
        center: ol.proj.fromLonLat([8.797379, 48.592204]),
        zoom: 13
    })
});

var ajax = function (method, url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.withCredentials = true;
    xhr.open(method, url, true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            callback(JSON.parse(xhr.responseText));
        }
    };
    if (method == 'POST') {
        xhr.setRequestHeader('Content-type', 'application/json');
    }
    xhr.send()
};

ajax('GET', url + '/api/server', function(server) {
    ajax('GET', url + '/api/session?token=' + token, function(user) {

        map.getView().setCenter(ol.proj.fromLonLat([
            parseFloat(getQueryParameter('longitude')) || user.longitude || server.longitude || 0.0,
            parseFloat(getQueryParameter('latitude')) || user.latitude || server.latitude || 0.0
        ]));
        map.getView().setZoom(parseFloat(getQueryParameter('zoom')) || user.zoom || server.zoom || 2);

        ajax('GET', url + '/api/devices', function(devices) {

            var socket = new WebSocket('ws' + url.substring(4) + '/api/socket');

            socket.onclose = function (event) {
                console.log('socket closed');
            };

            socket.onmessage = function (event) {
                var data = JSON.parse(event.data);
                if (data.positions) {
                    for (i = 0; i < data.positions.length; i++) {
                        var position = data.positions[i];
                        var marker = markers[position.deviceId];
                        var point = new ol.geom.Point(ol.proj.fromLonLat([position.longitude, position.latitude]));
                        if (!marker) {
                            var device = devices.find(function (device) { return device.id === position.deviceId });
                            marker = new ol.Feature(point);
                            marker.setStyle(style(device.name));
                            markers[position.deviceId] = marker;
                            source.addFeature(marker);
                        } else {
                            marker.setGeometry(point);
                        }
                    }
                }
            };

        });
    });
});
