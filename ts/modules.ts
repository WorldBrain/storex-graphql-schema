import * as graphqlTypes from "graphql";
import StorageManager from '@worldbrain/storex'
import { StorageModule } from '@worldbrain/storex-pattern-modules';
import { 
    PublicMethodDefinition, PublicMethodValues, PublicMethodValue, PublicMethodValueType,
    ensureDetailedPublicMethodValue, isPublicMethodCollectionType, isPublicMethodArrayType, PublicMethodDetailedArg, isPublicMethodObjectType, PublicMethodObjectType, PublicMethodDetailedValue
} from "@worldbrain/storex-pattern-modules/lib/types";
import { capitalize } from "./utils";
import { AutoPkType } from "./types";
import { storexToGraphQLFieldType, collectionsToGrapQL } from "./schema";

type CommonOptions = {autoPkType : AutoPkType, graphql : any}
type CommonOptionsWithTypes = CommonOptions & {collectionTypes, voidType}

export function createStorexGraphQLSchema(modules : {[name : string]: StorageModule}, options : {
    storageManager : StorageManager,
} & CommonOptions) : graphqlTypes.GraphQLSchema {
    const collectionTypes = collectionsToGrapQL(options.storageManager.registry, options)
    const voidType = new options.graphql.GraphQLObjectType({
        name: 'Void',
        fields: { void: { type: valueToGraphQL({ type: 'boolean', optional: true }, { ...options, collectionTypes, voidType: null }) } },
    })

    const queryModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        queryModules[moduleName] = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, voidType, type: 'query' })
    }

    const mutationModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        mutationModules[moduleName] = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, voidType, type: 'mutation' })
    }

    const queryType = new options.graphql.GraphQLObjectType({
        name: 'Query',
        fields: queryModules
    })
    const mutationType = new options.graphql.GraphQLObjectType({
        name: 'Mutation',
        fields: mutationModules
    })
    return new (options.graphql || graphqlTypes).GraphQLSchema({query: queryType, mutation: mutationType})
}

export function moduleToGraphQL(module : StorageModule, moduleName : string, options : {
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
        args: valuesToGraphQL(definition.args, options),
        resolve: async (parent, argsObject) => {
            const options = {}
            const args = []
            for (const [argName, argDefinition] of Object.entries(definition.args)) {
                const argValue = argsObject[argName]
                if ((ensureDetailedPublicMethodValue(argDefinition) as PublicMethodDetailedArg).positional) {
                    args.push(argValue)
                } else {
                    options[argName] = argValue
                }
            }
            if (Object.keys(options).length) {
                args.push(options)
            }
            
            const toReturn = await method(...args)
            return toReturn
        }
    }
}

export function valuesToGraphQL(values : PublicMethodValues, options : CommonOptionsWithTypes) {
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
        : objectReturnTypeToGraphQL(
            detailedReturns as PublicMethodDetailedValue<PublicMethodObjectType>,
            `${capitalize(options.moduleName)}${capitalize(methodDefinition.type)}${capitalize(methodName)}ReturnType`,
            options)
    return returnType
}

export function objectReturnTypeToGraphQL(
    value : PublicMethodDetailedValue<PublicMethodObjectType>,
    name : string, options : CommonOptionsWithTypes
) {
    const type = new options.graphql.GraphQLObjectType({
        name,
        fields: valuesToGraphQL(value.type.object, options),
    })
    return value.optional ? type : new options.graphql.GraphQLNonNull(type)
}

export function valueToGraphQL(value : PublicMethodValue, options : CommonOptionsWithTypes) {
    const detailedValue = ensureDetailedPublicMethodValue(value)
    const type = valueTypeToGraphQL(detailedValue.type, options)
    return detailedValue.optional ? type : new options.graphql.GraphQLNonNull(type)
}

export function valueTypeToGraphQL(valueType : PublicMethodValueType, options : CommonOptionsWithTypes) {
    if (typeof valueType === 'string') {
        return storexToGraphQLFieldType(valueType, {autoPkType: options.autoPkType, graphql: options.graphql})
    } else if (isPublicMethodArrayType(valueType)) {
        return new options.graphql.GraphQLList(valueTypeToGraphQL(valueType.array, options))
    } else if (isPublicMethodCollectionType(valueType)) {
        return options.collectionTypes[valueType.collection]
    }
}
