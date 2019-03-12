import * as graphqlTypes from "graphql";
import StorageManager from '@worldbrain/storex'
import { StorageModule } from '@worldbrain/storex-pattern-modules';
import { 
    PublicMethodDefinition, PublicMethodArgs, PublicMethodValueType,
    ensureDetailedPublicMethodValue, isPublicMethodCollectionType, PublicMethodValue, isPublicMethodArrayType, PublicMethodDetailedArg
} from "@worldbrain/storex-pattern-modules/lib/types";
import { capitalize } from "./utils";
import { AutoPkType } from "./types";
import { storexToGraphQLFieldType, collectionsToGrapQL } from "./schema";

export function createStorexGraphQLSchema(modules : {[name : string]: StorageModule}, options : {
    storageManager : StorageManager,
    autoPkType : AutoPkType,
    graphql : any
}) : graphqlTypes.GraphQLSchema {
    const collectionTypes = collectionsToGrapQL(options.storageManager.registry, options)

    const queryModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        queryModules[moduleName] = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, type: 'read-only' })
    }

    const mutationModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        mutationModules[moduleName] = moduleToGraphQL(module, moduleName, { ...options, collectionTypes, type: 'mutation' })
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

export function moduleToGraphQL(module : StorageModule, moduleName : string, options : {autoPkType : AutoPkType, collectionTypes, graphql : any, type: 'read-only' | 'mutation'}) {
    const graphQLMethods = {}
    for (const [methodName, methodDefinition] of Object.entries((module.getConfig()).methods || {})) {
        if (methodDefinition.type !== options.type) {
            continue
        }

        const method = module[methodName].bind(module)
        graphQLMethods[methodName] = methodToGraphQL(method, methodDefinition as PublicMethodDefinition, options)
    }

    const suffix = options.type === 'read-only' ? 'Query' : 'Mutation'
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

export function methodToGraphQL(method : Function, definition : PublicMethodDefinition, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    const returnType = valueToGraphQL(definition.returns, options)

    return {
        type: returnType,
        args: argsToGraphQL(definition.args, options),
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

export function argsToGraphQL(args : PublicMethodArgs, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    const fields = {}
    for (const [argName, convenientArg] of Object.entries(args)) {
        const arg = ensureDetailedPublicMethodValue(convenientArg)
        const type = valueToGraphQL(arg.type, options)
        fields[argName] = {
            type
        }
    }
    return fields
}

export function valueToGraphQL(value : PublicMethodValue, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    const detailedValue = ensureDetailedPublicMethodValue(value)
    const type = valueTypeToGraphQL(detailedValue.type, options)
    return detailedValue.optional ? type : new options.graphql.GraphQLNonNull(type)
}

export function valueTypeToGraphQL(valueType : PublicMethodValueType, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    if (typeof valueType === 'string') {
        return storexToGraphQLFieldType(valueType, {autoPkType: options.autoPkType, graphql: options.graphql})
    } else if (isPublicMethodArrayType(valueType)) {
        return new options.graphql.GraphQLList(valueTypeToGraphQL(valueType.array, options))
    } else if (isPublicMethodCollectionType(valueType)) {
        return options.collectionTypes[valueType.collection]
    }
}
