import * as graphqlTypes from "graphql";
import StorageManager, { StorageRegistry } from '@worldbrain/storex'
import { StorageModuleInterface } from '@worldbrain/storex-pattern-modules';
import { 
    PublicMethodDefinition, PublicMethodValues, PublicMethodValue, PublicMethodValueType,
    ensureDetailedPublicMethodValue, isPublicMethodCollectionType, isPublicMethodArrayType, PublicMethodDetailedArg, isPublicMethodObjectType, PublicMethodObjectType, PublicMethodDetailedValue
} from "@worldbrain/storex-pattern-modules/lib/types";
import { capitalize } from "./utils";
import { AutoPkType, StorexGraphQLSchemaEvent } from "./types";
import { storexToGraphQLFieldType, collectionsToGrapQL } from "./schema";

type CommonOptions = {autoPkType : AutoPkType, graphql : typeof graphqlTypes, observer? : (event : StorexGraphQLSchemaEvent) => void}
type CommonOptionsWithTypes = CommonOptions & {collectionTypes, collectionInputs, voidType}

export function createStorexGraphQLSchema(modules : {[name : string]: StorageModuleInterface}, options : {
    storageRegistry : StorageRegistry,
} & CommonOptions) : graphqlTypes.GraphQLSchema {
    const collectionTypes = collectionsToGrapQL(options.storageRegistry, options)
    const collectionInputs = collectionsToGrapQL(options.storageRegistry, { ...options, asInput: true })
    const voidType = new options.graphql.GraphQLObjectType({
        name: 'Void',
        fields: { void: { type: valueToGraphQL({ type: 'boolean', optional: true }, { ...options, collectionTypes, collectionInputs, voidType: null }) } },
    })

    const queryModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        const graphQLModule = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, collectionInputs, voidType, type: 'query' })
        if (graphQLModule) {
            queryModules[moduleName] = graphQLModule
        }
    }

    const mutationModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        const graphQLModule = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, collectionInputs, voidType, type: 'mutation' });
        if (graphQLModule) {
            mutationModules[moduleName] = graphQLModule
        }
    }

    if (!Object.keys(queryModules).length) {
        throw new Error(`Schemas without any 'query' methods are not supported (yet?)`)
    }

    const queryType = new options.graphql.GraphQLObjectType({
        name: 'Query',
        fields: queryModules
    })
    const mutationType = Object.keys(mutationModules).length ? new options.graphql.GraphQLObjectType({
        name: 'Mutation',
        fields: mutationModules
    }) : null
    return new options.graphql.GraphQLSchema({query: queryType, mutation: mutationType})
}

export function moduleToGraphQL(module : StorageModuleInterface, moduleName : string, options : {
    type: 'query' | 'mutation'
} & CommonOptionsWithTypes) {
    const graphQLMethods = {}
    for (const [methodName, methodDefinition] of Object.entries((module.getConfig()).methods || {})) {
        if (methodDefinition.type !== options.type) {
            continue
        }

        const method = module[methodName].bind(module)
        graphQLMethods[methodName] = methodToGraphQL(method, methodName, methodDefinition as PublicMethodDefinition, {...options, moduleName})
    }
    if (!Object.keys(graphQLMethods).length) {
        return null
    }

    const suffix = options.type === 'query' ? 'Query' : 'Mutation'
    return {
        type: new options.graphql.GraphQLObjectType({
            name: `${capitalize(moduleName)}${suffix}`,
            fields: graphQLMethods,
        }),
        resolve: () => {
            return {}
        }
    }
}

export function methodToGraphQL(method : Function, methodName : string, definition : PublicMethodDefinition, options : {
    moduleName : string
} & CommonOptionsWithTypes) {
    const returnType = returnTypeToGraphQL(definition, methodName, options)

    return {
        type: returnType,
        args: valuesToGraphQL(definition.args, { ...options, asInput: true }),
        resolve: async (parent, argsObject) => {
            if (options.observer) {
                options.observer({ type: 'call.incoming', moduleName: options.moduleName, methodName, argsObject })
            }

            const callOptions = {}
            const callArgs = []
            for (const [argName, argDefinition] of Object.entries(definition.args)) {
                const argValue = argsObject[argName]
                if ((ensureDetailedPublicMethodValue(argDefinition) as PublicMethodDetailedArg).positional) {
                    callArgs.push(argValue)
                } else {
                    callOptions[argName] = argValue
                }
            }
            if (Object.keys(callOptions).length) {
                callArgs.push(callOptions)
            }
            
            if (options.observer) {
                options.observer({ type: 'call.prepared', moduleName: options.moduleName, methodName, args: callArgs })
            }
            const returnValue = await method(...callArgs)
            if (options.observer) {
                options.observer({ type: 'call.processed', moduleName: options.moduleName, methodName, returnValue })
            }
            return returnValue
        }
    }
}

export function valuesToGraphQL(values : PublicMethodValues, options : CommonOptionsWithTypes & {asInput? : boolean}) {
    const fields = {}
    for (const [valueName, value] of Object.entries(values)) {
        const detailedValue = ensureDetailedPublicMethodValue(value)
        const type = valueToGraphQL(detailedValue.type, options)
        fields[valueName] = {
            type
        }
    }
    return fields
}

export function returnTypeToGraphQL(methodDefinition : PublicMethodDefinition, methodName : string, options : {
    moduleName : string
} & CommonOptionsWithTypes) {
    if (methodDefinition.returns === 'void') {
        return options.voidType
    }

    const detailedReturns = ensureDetailedPublicMethodValue(methodDefinition.returns)
    const returnType =
        !isPublicMethodObjectType(detailedReturns.type)
        ? valueToGraphQL(detailedReturns, options)
        : objectValueTypeToGraphQL(
            detailedReturns as PublicMethodDetailedValue<PublicMethodObjectType>,
            `${capitalize(options.moduleName)}${capitalize(methodDefinition.type)}${capitalize(methodName)}ReturnType`,
            options)
    return returnType
}

export function objectValueTypeToGraphQL(
    value : PublicMethodDetailedValue<PublicMethodObjectType>,
    name : string, options : CommonOptionsWithTypes
) {
    const type = new options.graphql.GraphQLObjectType({
        name,
        fields: valuesToGraphQL(value.type.object, options),
    })
    return value.optional ? type : new options.graphql.GraphQLNonNull(type)
}

export function valueToGraphQL(value : PublicMethodValue, options : CommonOptionsWithTypes & {asInput? : boolean}) {
    const detailedValue = ensureDetailedPublicMethodValue(value)
    const type = valueTypeToGraphQL(detailedValue.type, options)
    return detailedValue.optional ? type : new options.graphql.GraphQLNonNull(type)
}

export function valueTypeToGraphQL(valueType : PublicMethodValueType, options : CommonOptionsWithTypes & {asInput? : boolean}) {
    if (typeof valueType === 'string') {
        return storexToGraphQLFieldType(valueType, {autoPkType: options.autoPkType, graphql: options.graphql})
    } else if (isPublicMethodArrayType(valueType)) {
        return new options.graphql.GraphQLList(valueTypeToGraphQL(valueType.array, options))
    } else if (isPublicMethodCollectionType(valueType)) {
        if (options.asInput) {
            return options.collectionInputs[valueType.collection]
        } else {
            return options.collectionTypes[valueType.collection]
        }
    } else if (isPublicMethodObjectType(valueType)) {
        return objectValueTypeToGraphQL({ type: valueType }, valueType.singular, options)
    } else {
        throw new Error(`Encountered unknown value type: ${JSON.stringify(valueType)}`)
    }
}

export function storexGraphQLSchemaLogger(options : { eventTypes : string[] | 'all' }) {
    const eventTypes = new Set(options.eventTypes)
    return (event : StorexGraphQLSchemaEvent) => {
        if (options.eventTypes === 'all' || eventTypes.has(event.type)) {
            console.log('Storex GraphQL client event', event)
        }
    }
}
