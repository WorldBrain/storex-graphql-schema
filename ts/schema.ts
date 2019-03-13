import * as graphqlTypes from "graphql";
import StorageRegistry from "@worldbrain/storex/lib/registry";
import { FieldType, CollectionFields, CollectionDefinitions } from "@worldbrain/storex/lib/types";
import { capitalize } from "./utils";
import { AutoPkType } from "./types";

type CommonOptions = {autoPkType : AutoPkType, asInput? : boolean, graphql : any}

export function exportSchemaTypes(storageRegistry : StorageRegistry, options : CommonOptions) : graphqlTypes.GraphQLSchema {
    const types = collectionsToGrapQL(storageRegistry, options)

    const queryFields = {}
    for (const collectionName of Object.keys(storageRegistry.collections)) {
        queryFields[collectionName] = {
            type: types[collectionName]
        }
    }

    const queryType = new options.graphql.GraphQLObjectType({
        name: 'Query',
        fields: queryFields
    })
    return new options.graphql.GraphQLSchema({query: queryType})
}

export function collectionsToGrapQL(storageRegistry : StorageRegistry, options : CommonOptions) {
    const types : {[name : string] : graphqlTypes.GraphQLType} = {}
    for (const [collectionName, collectionDefinition] of Object.entries(storageRegistry.collections)) {
        const graphQLClass = options.asInput ? options.graphql.GraphQLInputObjectType : options.graphql.GraphQLObjectType
        let graphQLName = capitalize(collectionName)
        if (options.asInput) {
            graphQLName += 'Input'
        }

        types[collectionName] = new graphQLClass({
            name: graphQLName,
            fields: storexToGrapQLFields(collectionDefinition.fields, options)
        })
    }
    return types
}

export function storexToGrapQLFields(collectionFields : CollectionFields, options : CommonOptions) {
    const fields = {}
    for (const [fieldName, fieldDefinition] of Object.entries(collectionFields)) {
        if (options.asInput && fieldDefinition.type === 'auto-pk') {
            continue
        }

        const fieldType = storexToGraphQLFieldType(fieldDefinition.type, options);
        const optional = fieldDefinition.optional
        fields[fieldName] = {type: optional ? fieldType : new options.graphql.GraphQLNonNull(fieldType)}
    }
    return fields
}

export function storexToGraphQLFieldType(fieldType : FieldType, options : CommonOptions) {
    const FIELD_TYPES = {
        string: options.graphql.GraphQLString,
        float: options.graphql.GraphQLFloat,
        int: options.graphql.GraphQLInt,
        boolean: options.graphql.GraphQLBoolean,
        timestamp: options.graphql.GraphQLFloat,
    }

    if (fieldType === 'auto-pk') {
        fieldType = options.autoPkType
    }

    const graphQLType = FIELD_TYPES[fieldType]
    if (!graphQLType) {
        throw new Error(`Could not convert field type to GraphQL field type: ${fieldType}`)
    }
    return graphQLType
}
