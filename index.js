
var unique = require('array-unique')
var _ = require('underscore')
var promise = require('promise')

function Query(table) {

	this.table = table

	this.constraints = []
}

Query.prototype.firstPage = function(params) {

	return this.select(params).then(function (select) {

		return new Promise(function (resolve, reject) {

			select.firstPage(function (error, records) {

				if (error) {
					reject(error)
				}

				resolve(records)
			})
		})
	})
}

Query.prototype.all = function(params) {

	return this.select(params).then(function (select) {

		return new Promise(function (resolve, reject) {

			select.all(function (error, records) {

				if (error) {
					reject(error)
				}

				resolve(records)
			})
		})
	})
}

Query.prototype.each = function(params, eachCallback) {

	if (typeof params === 'function') {
		eachCallback = params
		params = null
	}

	return this.select(params).then(function (select) {

		return new Promise(function (resolve, reject) {

			select.eachPage(function (records, next) {

				records.forEach(function(record) {
					eachCallback(record)
			    })

			    next()

			}, function (error) {

				if (error) {
					reject(error)
				}

				resolve()
			})
		})
	})
}

Query.prototype.select = function (params) {

	if (!params) {
		params = {}
	}

	var self = this
	return Promise.all(this.constraints).then(function (constraints) {
		params.filterByFormula = and(constraints)
		console.log('filterByFormula: ' + params.filterByFormula)
		return self.table.select(params)
	})
}

Query.prototype.equalTo = function(key, value) {

	if (isRecordId(key) && !value) {
		value = key
		key = 'RECORD_ID()'
	}

	return this.compare(key, value, equal)
}

Query.prototype.greaterThan = function (key, value) {
	return this.compare(key, value, greaterThan)
}

Query.prototype.greaterThanOrEqualTo = function (key, value) {
	return this.compare(key, value, greaterThanOrEqualTo)
}

Query.prototype.lessThan = function (key, value) {
	return this.compare(key, value, lessThan)
}

Query.prototype.lessThanOrEqualTo = function (key, value) {
	return this.compare(key, value, lessThanOrEqualTo)
}

Query.prototype.compare = function(key, value, operation) {

	key = sanitizeKey(key)
	value = sanitizeValue(value)

	this.constraints.push(operation(key, value))
	return this
}

Query.prototype.containedIn = function(key, array) {
	//console.log('typeof key: ' + typeof key + ', key.length: ' + key.length + ', isRecordId(): ' + isRecordId(key[0]))
	if (key.constructor == Array && key.length > 0 && isRecordId(key[0]) && !array) {
		array = key
		key = 'RECORD_ID()'
	}

	key = sanitizeKey(key)

	var uniqueArray = unique(array)

	var operations = []
	_.each(uniqueArray, function (value) {
		value = sanitizeValue(value)
		operations.push(equal(key, value))
	})

	this.constraints.push(or(operations))
	return this
}

Query.prototype.matchesKeyInQuery = function(key, queryKey, query) {

	key = sanitizeKey(key)
	queryKey = sanitizeKey(queryKey)

	var matchValues = []

	var promise = query.all().then(function (results) {

		results.forEach(function (result) {
			var operation = equal(key, result.get(queryKey))
			matchValues.push(operation)
		})

		return or(matchValues)

	})

	this.constraints.push(promise)
	return this
}

function and(args) {
	return logical('AND', args)
}

function or(args) {
	return logical('OR', args)
}

function logical(name, args) {

	if (args.length == 1) {
		return args[0]
	}

	return buildFunction(name, args)
}

function equal(val1, val2) {
	return logicalOperator(val1, '=', val2)
}

function notEqual(val1, val2) {
	return logicalOperator(val1, '!=', val2)
}

function greaterThan(val1, val2) {
	return logicalOperator(val1, '>', val2)
}

function greaterThanOrEqualTo(val1, val2) {
	return logicalOperator(val1, '>=', val2)
}

function lessThan(val1, val2) {
	return logicalOperator(val1, '<', val2)
}

function lessThanOrEqualTo(val1, val2) {
	return logicalOperator(val1, '<=', val2)
}

function logicalOperator(val1, operator, val2) {
	return val1 + operator + val2
}

function buildFunction(name, args) {


	args = unique(args)

	var argsString = ''
	_.each(args, function (arg) {
		argsString += arg + ","
	})

	argsString = argsString.substring(0, argsString.length - 1)

	return name + '(' + argsString + ')'
}

function isRecordId(value) {
	//console.log('typeof value: ' + typeof value + ", value.length: " + value.length + ", value.substring: " + value.substring(0, 3))
	return typeof value == 'string' && value.length == 17 && value.substring(0, 3) == 'rec'
}

function sanitizeKey(key) {

	if (key.split(' ').length > 1) {
		
		if (key[0] != '{') {
			key = '{' + key
		}

		if (key[key.length - 1] != '}') {
			key = key + '}'
		}
	}

	return key
}

function sanitizeValue(value) {

	if (value === true) {
		return 'TRUE()'
	}

	if (value === false) {
		return 'FALSE()'
	}

	if (typeof value == 'string') {
		return "\"" + value + "\""
	}

	return value
}

module.exports = Query