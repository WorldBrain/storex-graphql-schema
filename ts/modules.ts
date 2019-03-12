import * as graphqlTypes from "graphql";
import StorageManager from '@worldbrain/storex'
import { StorageModule } from '@worldbrain/storex-pattern-modules';
import { 
    PublicMethodDefinition, PublicMethodArgs, PublicMethodValueType,
    ensureDetailedPublicMethodValue, isPublicMethodCollectionType, PublicMethodValue, isPublicMethodArrayType
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

    const graphQLModules = {}
    for (const [moduleName, module] of Object.entries(modules)) {
        graphQLModules[moduleName] = moduleToGraphQL(module, { ...options, collectionTypes })
    }

    const queryType = new options.graphql.GraphQLObjectType({
        name: 'Query',
        fields: graphQLModules
    })
    return new (options.graphql || graphqlTypes).GraphQLSchema({query: queryType})
}

export function moduleToGraphQL(module : StorageModule, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    const graphQLMethods = {}
    for (const [methodName, methodDefinition] of Object.entries((module.getConfig()).methods || {})) {
        const method = module[methodName].bind(module)
        graphQLMethods[methodName] = methodToGraphQL(method, methodDefinition as PublicMethodDefinition, options)
    }

    return {
        type: new options.graphql.GraphQLObjectType({
            name: 'Users',
            fields: graphQLMethods,
        }),
        resolve: () => {
            return {}
        }
    }
}

export function methodToGraphQL(method : Function, definition : PublicMethodDefinition, options : {autoPkType : AutoPkType, collectionTypes, graphql : any}) {
    const returnType = definition.returns !== 'void' ? valueToGraphQL(definition.returns, options) : null

    return {
        type: returnType,
        args: argsToGraphQL(definition.args, options),
        resolve: (parent, {name}) => {
            return method({name})
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
