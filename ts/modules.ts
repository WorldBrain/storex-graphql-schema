import * as graphql from "graphql";
import StorageManager from '@worldbrain/storex'
import { StorageModule } from '@worldbrain/storex-pattern-modules';
import { capitalize } from "./utils";
import { StorageModuleConfigWithMethods, PublicMethodDefinition, PublicMethodArgs, ensureDetailedPublicMethodArg, AutoPkType, PublicMethodValueType, isPublicMethodCollectionType } from "./types";
import { storexToGraphQLFieldType, collectionsToGrapQL } from "./schema";

export function createStorexGraphQLSchema(options : {
    storageManager : StorageManager,
    modules : {[name : string]: StorageModule},
    autoPkType : AutoPkType
}) : graphql.GraphQLSchema {
    const collectionTypes = collectionsToGrapQL(options.storageManager.registry, {autoPkType: options.autoPkType})

    const graphQLModules = {}
    for (const [moduleName, module] of Object.entries(options.modules)) {
        graphQLModules[moduleName] = moduleToGraphQL({module, autoPkType: options.autoPkType, collectionTypes})
    }
    // graphQLModules['bla'] = {
    //     type: graphql.GraphQLInt,
    //     resolve: () => 5
    // }

    const queryType = new graphql.GraphQLObjectType({
        name: 'Query',
        fields: graphQLModules
    })
    return new graphql.GraphQLSchema({query: queryType})
}

export function moduleToGraphQL(options : {module : StorageModule, autoPkType : AutoPkType, collectionTypes}) {
    const graphQLMethods = {}
    for (const [methodName, methodDefinition] of Object.entries((options.module.getConfig() as StorageModuleConfigWithMethods).methods)) {
        const method = options.module[methodName].bind(options.module)
        graphQLMethods[methodName] = methodToGraphQL({
            method,
            definition: methodDefinition,
            autoPkType: options.autoPkType,
            collectionTypes: options.collectionTypes
        })
    }

    return {
        type: new graphql.GraphQLObjectType({
            name: 'Users',
            fields: graphQLMethods,
        }),
        resolve: () => {
            return {}
        }
    }
}

export function methodToGraphQL(options : {method : Function, definition : PublicMethodDefinition, autoPkType : AutoPkType, collectionTypes}) {
    return {
        type: valueTypeToGraphQL({valueType: options.definition.returns, autoPkType: options.autoPkType, collectionTypes: options.collectionTypes}),
        args: argsToGraphQL({
            args: options.definition.args,
            autoPkType: options.autoPkType,
            collectionTypes: options.collectionTypes
        }),
        resolve: (parent, {name}) => {
            return options.method({name})
        }
    }
}

export function argsToGraphQL(options : {args : PublicMethodArgs, autoPkType : AutoPkType, collectionTypes}) {
    const fields = {}
    for (const [argName, convenientArg] of Object.entries(options.args)) {
        const arg = ensureDetailedPublicMethodArg(convenientArg)
        fields[argName] = {
            type: valueTypeToGraphQL({ valueType: arg.type, autoPkType: options.autoPkType, collectionTypes: options.collectionTypes })
        }
    }
    return fields
}

export function valueTypeToGraphQL(options : {valueType : PublicMethodValueType, autoPkType : AutoPkType, collectionTypes}) {
    if (typeof options.valueType === 'string') {
        return storexToGraphQLFieldType(options.valueType, {autoPkType: options.autoPkType})
    } else if (isPublicMethodCollectionType(options.valueType)) {
        return options.collectionTypes[options.valueType.collection]
    }
}
