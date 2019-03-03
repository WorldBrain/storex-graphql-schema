import { PrimitiveFieldType } from '@worldbrain/storex/lib/types/fields'
import { StorageModuleConfig } from '@worldbrain/storex-pattern-modules';

export type StorageModuleConfigWithMethods = StorageModuleConfig & {methods : PublicMethodDefinitions}
export type PublicMethodDefinitions = {[name : string] : PublicMethodDefinition}

export interface PublicMethodDefinition {
    args : PublicMethodArgs
    returns : PublicMethodValueType
}

export type PublicMethodArgs = {[name : string] : PublicMethodArg}
export type PublicMethodArg = PublicMethodValueType | PublicMethodDetailedArg
export type PublicMethodDetailedArg = { type : PublicMethodValueType, optional? : boolean }
export const isDetailedPublicMethodArg = (arg : PublicMethodArg) : arg is PublicMethodDetailedArg => !!arg['type']
export const ensureDetailedPublicMethodArg = (arg : PublicMethodArg) : PublicMethodDetailedArg =>
    isDetailedPublicMethodArg(arg) ? arg : { type: arg }

export type PublicMethodValueType = PublicMethodScalarType | PublicMethodCollectionType
export type PublicMethodScalarType = PrimitiveFieldType
export type PublicMethodCollectionType = { collection : string }
export const isPublicMethodCollectionType = (valueType : PublicMethodValueType) : valueType is PublicMethodCollectionType =>
    !!valueType['collection']

export type AutoPkType = 'int' | 'string'