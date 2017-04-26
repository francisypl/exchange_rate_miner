var RTM = require('satori-sdk-js');
const request = require('request');
const _ = require('underscore');

var endpoint = 'wss://open-data.api.satori.com';
var appKey = '7DFC78ABbFbecaAc5d4e7FBE18E1FDE1';
var channel = 'exchange-rates';

var rtm = new RTM(endpoint, appKey);
rtm.on('enter-connected', function() {
    console.log('Connected to RTM!');
});

var latestRates = null;

var subscription = rtm.subscribe(channel, RTM.SubscriptionMode.SIMPLE);
subscription.on('rtm/subscription/data', function (pdu) {
    pdu.body.messages.forEach(function (msg) {
        const msgObj = JSON.parse(msg);
        const base = msgObj.base;
        const rates = msgObj.rates;
        const rangeBuffer = 0.0001;
        const isNewRate = (oldRate, newRate) => {
            // if the currency doesn't exist yet
            if (_.isNull(oldRate) || _.isUndefined(oldRate)) {
                return true;
            }

            return newRate <= oldRate - rangeBuffer || newRate >= oldRate + rangeBuffer;
        };

        let uploadStories = [];
        // Format the stories
        _.each(_.keys(rates), function(currency) {
            if (_.isNull(latestRates) ||
               (!_.isNull(latestRates) && isNewRate(latestRates[currency], rates[currency]))) {
                let story = {
                    title: `${base} to ${currency} : 1 to ${rates[currency]}`,
                    url: `http://www.xe.com/currencyconverter/convert/?Amount=1&From=${base}&To=${currency}`,
                    source: 'exchange_rate_miner'
                };
                uploadStories.push(story);
            }
        });

        // Upload them
        if (!_.isEmpty(uploadStories)) {
            request.post({
                url: 'http://localhost:10010/api/v1/miners/5900fbc638675e6d72747b45/story',
                json: true,
                headers: {
                    'content-type': 'application/json'
                },
                body: uploadStories
            }, function(err, httpResponse, body) {
                if (err) {
                    return console.error('Error:', err);
                }

                console.log('Success:', body);
            });
        }

        if (_.isNull(latestRates)) {
            latestRates = msgObj.rates;
        }
    });
});

rtm.start();
