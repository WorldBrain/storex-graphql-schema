import * as graphqlTypes from "graphql";
import StorageRegistry from "@worldbrain/storex/lib/registry";
import { FieldType, CollectionFields, CollectionDefinitions } from "@worldbrain/storex/lib/types";
import { capitalize } from "./utils";
import { AutoPkType } from "./types";

export function exportSchemaTypes(storageRegistry : StorageRegistry, options : {autoPkType : AutoPkType, graphql : any}) : graphqlTypes.GraphQLSchema {
    const types = collectionsToGrapQL(storageRegistry, options)

    const queryFields = {}
    for (const [collectionName, collectionDefinition] of Object.entries(storageRegistry.collections)) {
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

export function collectionsToGrapQL(storageRegistry : StorageRegistry, options : {autoPkType : AutoPkType, graphql : any}) {
    const types : {[name : string] : graphqlTypes.GraphQLObjectType} = {}
    for (const [collectionName, collectionDefinition] of Object.entries(storageRegistry.collections)) {
        types[collectionName] = new options.graphql.GraphQLObjectType({
            name: capitalize(collectionName),
            fields: storexToGrapQLFields(collectionDefinition.fields, options)
        })
    }
    return types
}

export function storexToGrapQLFields(collectionFields : CollectionFields, options : {autoPkType : AutoPkType, graphql : any}) {
    const fields = {}
    for (const [fieldName, fieldDefinition] of Object.entries(collectionFields)) {
        const fieldType = storexToGraphQLFieldType(fieldDefinition.type, options);
        fields[fieldName] = {type: fieldDefinition.optional ? fieldType : new options.graphql.GraphQLNonNull(fieldType)}
    }
    return fields
}

export function storexToGraphQLFieldType(fieldType : FieldType, options : {autoPkType : AutoPkType, graphql : any}) {
    const FIELD_TYPES = {
        string: options.graphql.GraphQLString,
        int: options.graphql.GraphQLInt,
        boolean: options.graphql.GraphQLBoolean,
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
