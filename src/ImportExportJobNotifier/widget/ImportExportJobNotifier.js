/**
 Notifier widget
 ========================

 @file      : ImportExportJobNotifier.js
 @version   : 1.0
 @author    : Diego Slijkhuis
 @date      : 13-12-2016
 @copyright : Mansystems Nederland B.V.
 @license   : Apache License, Version 2.0, January 2004

 Documentation
 =============
 ExpertDesk 9.6 specific widget to notify a user in case a background action has finished
 Change log
 ==========
 1.0 Initial release

 */
// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
	"dojo/_base/declare",
	"mxui/widget/_WidgetBase",
	"dojo/_base/lang"
], function(declare, _WidgetBase, dojoLang){
	"use strict";
	// Declare widget's prototype.
	return declare("ImportExportJobNotifier.widget.ImportExportJobNotifier", [_WidgetBase], {
		// Template path
		// Parameters configured in the Modeler.
		pollInterval: 					null,
		limitCheck: 						null,
		limitToSession: 				null,
		displayErrorAs: 				null,

		notificationEntity: 		null,
		successText: 						null,
		errorText: 							null,
		dateKey: 								null,
		sendKey: 								null,

		checkEntity: 						null,
		checkAttribute: 				null,
		attributeSuccessValue: 	null,
		attributeErrorValue: 		null,

		_refEntity:							null,
		_refAssoc:							null,
    _isPolling: 						false,
    _lastPollingTime:				null,
		_handles: 							null,
		_jobList: 							null,
		_pollingOffsetDate: 		null,
		_pendingNotifications:	null,

    constructor: function(){
    	this._notified = [];
    	this._pendingNotifications = [];
    },
    postCreate: function(){
		//  logger.level(logger.DEBUG);
	    this._logDebug("postCreate");
			this._logDebug("pollInterval", this.pollInterval);
			this._logDebug("limitCheck", this.limitCheck);
			this._logDebug("limitToSession", this.limitToSession);

			this._logDebug("notificationEntity", this.notificationEntity);
			this._logDebug("successText", this.successText);
			this._logDebug("errorText", this.errorText);
			this._logDebug("dateKey", this.dateKey);
			this._logDebug("sendKey", this.sendKey);

			this._logDebug("checkEntity", this.checkEntity);
			this._logDebug("checkAttribute", this.checkAttribute);
			this._logDebug("attributeSuccessValue", this.attributeSuccessValue);
			this._logDebug("attributeErrorValue", this.attributeErrorValue);

			if(typeof this.checkEntity == "string"){
				var p = this.checkEntity.split("/");
				if(p.length == 2) {
					this._refAssoc 	= p[0];
					this._refEntity = p[1];
				}
			} else throw "EmptyAssociationException";
			this._setPollingSubscription();
			this._startPolling();
    },
    uninitialize: function(){
      this._logDebug("uninitialize");
    },
    _getPollingOffset: function(){
			this._logDebug("_getPollingOffset");
    	var returner = null;
			if(this.limitCheck == "login"){
      	if(mx && mx.sessions){
      		returner = mx.session.getUserAttribute('LastLogin');
      	}
      	returner = returner || ((new Date()).getTime()) - (60000); //fall back to current - 1 minute
      }else if(this.limitCheck == "polling"){
      	returner = ((new Date()).getTime()) - (60000);
      }
      return returner;
    },
    _startPolling: function(){
			this._logDebug("_startPolling");
      // check if widget currently already is polling; if so, do nothing
      if(this._isPolling == true) return;
			this._isPolling = true;
      // check setting for this.limitToSession and set the appropriate value for this._pollingOffsetDate
      this._pendingNotifications = []; // clear pending when starting a new polling session
			this._pollingOffsetDate = this._getPollingOffset();
			// although the messages are already sent to the client; if the user closed and reopend the browser
			// continueing a previous session. It might not pick up those notifications anymore. Therefore fetch all (with date offset if set so))
			this._fetchNewNotifications(this._pollingOffsetDate);
    },
		_fetchNewNotifications: function(dateOffset){     
			this._logDebug("_fetchNewNotifications ", dateOffset); 
      var xpathReferenceConstraint = this.checkEntity + "[" + this.checkAttribute + " != '" +  this.attributeSuccessValue + "' and " + this.checkAttribute + " != '" + this.attributeErrorValue + "']";
      var xpathDateCheck = "";
			if(dateOffset != null){
				if(dateOffset > 0 && this.dateKey != null)
					xpathDateCheck = this.dateKey + " != empty and " + this.dateKey + " >= '" + dateOffset  + "' and ";
			}
			
      var xpathStr = "//" + this.notificationEntity + "[System.owner = '" + mx.session.getUserId() + "' and " + xpathDateCheck + this.sendKey + " = false() and " + xpathReferenceConstraint + "]";
			mx.data.get({
      	xpath: xpathStr,
      	filter: {
      		attributes: [this.successText, this.errorText]
      	},
      	callback: function(objList){      
      		for(var i = 0; i < objList.length; i++){
      			var obj = objList[i];
      			if(obj && obj.getGuid && obj.getReferences){
      				if(obj.getReference(this._refAssoc) != null){
      					this._pendingNotifications["mxid"+obj.getReference(this._refAssoc)] = obj;
      				}
      			}
      		}
      		this._logDebug("pendings", this._pendingNotifications);
					if(this._pendingNotifications != null && Object.keys(this._pendingNotifications).length > 0){
						if(this._isPolling == true){
      				this._logDebug("setting timeout", this._pendingNotifications);
							setTimeout(dojoLang.hitch(this, this._pollingAction), (this.pollInterval*1000));
						}else{ ;	// set it as running and mark first polling time
							this._isPolling = true;
							this._pollingAction();
						}
					} else {
							this._isPolling = false;
					}
      	}
      }, this);
		},
		_notifyUser: function(mxid, stateValue){
			if(!mxid || !stateValue) return;
			var notification = this._pendingNotifications["mxid" + mxid];
			if(notification == null) return;
			var isSend = false;
			if(stateValue == this.attributeSuccessValue){
				mx.ui.info(notification.get(this.successText) , false);
				isSend = true;
			}else if(stateValue == this.attributeErrorValue){
				switch (this.displayErrorAs){
					case "info":
						mx.ui.info(notification.get(this.errorText) , false);
						isSend = true;
						break;
					case "warning":
						mx.ui.warning(notification.get(this.errorText) , false);
						isSend = true;
						break;
					case "error":
						mx.ui.error(notification.get(this.errorText) , false);
						isSend = true;
						break;
				}
			}
			if(isSend){
				notification.set(this.sendKey, true);
				delete this._pendingNotifications["mxid" + mxid];
				mx.data.commit({
					mxobj: notification,
					callback: function (o){
						this._logDebug("Committed notification object [" + mxid + "]");
					},
					error: function(e){
						this._logDebug("Error committing notification object [" + mxid + "]", e);
					}
				}, this);
			}
		},
		_checkFinishedJobs: function(){
			var xpathRefConstrPart = "";
			if(this._pollingOffsetDate != null && this._pollingOffsetDate > 0 && this.dateKey != null)
				xpathRefConstrPart = this.dateKey + " != empty and " + this.dateKey + " >= '" + this._pollingOffsetDate  + "'";
			if (xpathRefConstrPart != "") {
				xpathRefConstrPart = xpathRefConstrPart + " and " + this.sendKey + " = false()";
				xpathRefConstrPart = "[" +xpathRefConstrPart + "]";
			}
			var xpathRefConstr = "[" + this._refAssoc + "/" + this.notificationEntity + xpathRefConstrPart + "]";
			var xpathConstr = "[" + this.checkAttribute + " = '" + this.attributeErrorValue + "' or " + this.checkAttribute + " = '" + this.attributeSuccessValue + "']";
			var xpathStr = "//" + this._refEntity + xpathConstr + xpathRefConstr;

			mx.data.get({
				xpath: xpathStr,
				filter: {
					attributes: [this.checkAttribute]
				},
				callback: function(objList){
					for(var i = 0; i < objList.length; i++){
						var obj = objList[i];
						this._notifyUser(obj.getGuid(), obj.get(this.checkAttribute));
					}
					this._pollingAction(2);
				}
			}, this);
		},
    _pollingAction: function (phase){
			this._logDebug("_pollingAction", phase);
			if(!phase) this._checkFinishedJobs();
			else if(phase == 2){
				this._lastPollingTime = (new Date()).getTime();
				this._fetchNewNotifications(this._lastPollingTime);
			}
    },
		_setPollingSubscription: function(){
			this._logDebug("_setPollingSubscription on [" + this.notificationEntity + "]");
    	this._handles = this.subscribe({
		    entity: this.notificationEntity,
		    callback: dojoLang.hitch(this, this._startPolling)
		  });
		},
    _updateRendering: function(){
    },
		_toString: function(){
		  return "[ImportExportJobNotifier.widget.ImportExportJobNotifier]";
		},
		_logDebug: function(){
			var args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
			if(args.length){
				if(args.length  == 1)
	    		logger.debug(this.id + ": " + args[0]);
				else if(args.length == 2)
	    		logger.debug(this.id + ": " + args[0], args[1]);
				else if(args.length > 2)
	    		logger.debug(this.id + ": " + args[0], args);
	    }
		}
	});
});

require(["ImportExportJobNotifier/widget/ImportExportJobNotifier"], function(){
    "use strict";
});
