import * as graphql from "graphql";
import StorageManager from '@worldbrain/storex'
import { StorageModule } from '@worldbrain/storex-pattern-modules';
import { capitalize } from "./utils";
import { StorageModuleConfigWithMethods, PublicMethodDefinition, PublicMethodArgs, ensureDetailedPublicMethodArg, AutoPkType } from "./types";
import { storexToGraphQLFieldType } from "./schema";

export function createStorexGraphQLSchema(options : {
    storageManager : StorageManager,
    modules : {[name : string]: StorageModule},
    autoPkType : AutoPkType
}) : graphql.GraphQLSchema {
    const graphQLModules = {}
    for (const [moduleName, module] of Object.entries(options.modules)) {
        graphQLModules[moduleName] = moduleToGraphQL({module, autoPkType: options.autoPkType})
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

export function moduleToGraphQL(options : {module : StorageModule, autoPkType : AutoPkType}) {
    const graphQLMethods = {}
    for (const [methodName, methodDefinition] of Object.entries((options.module.getConfig() as StorageModuleConfigWithMethods).methods)) {
        const method = options.module[methodName].bind(options.module)
        graphQLMethods[methodName] = methodToGraphQL({method, definition: methodDefinition, autoPkType: options.autoPkType})
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

export function methodToGraphQL(options : {method : Function, definition : PublicMethodDefinition, autoPkType : AutoPkType}) {
    return {
        type: new graphql.GraphQLObjectType({
            name: 'User',
            fields: {
                name: { type: graphql.GraphQLString },
                age: { type: graphql.GraphQLInt },
            },
        }),
        args: argsToGraphQL({args: options.definition.args, autoPkType: options.autoPkType}),
        resolve: (parent, {name}) => {
            return options.method({name})
        }
    }
}

export function argsToGraphQL(options : {args : PublicMethodArgs, autoPkType : AutoPkType}) {
    const fields = {}
    for (const [argName, convenientArg] of Object.entries(options.args)) {
        const arg = ensureDetailedPublicMethodArg(convenientArg)
        if (typeof arg.type === 'string') {
            fields[argName] = { type: storexToGraphQLFieldType(arg.type, {autoPkType: options.autoPkType}) }
        }
    }
    return fields
}
