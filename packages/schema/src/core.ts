export interface SchemaMeta {
  name: string;
  [key: string]: any;
}

export interface SchemaPropertyMeta {
  key: string;
}

export type SchemaFunction<T = any, O = any, C = any> =
  ((value: any, object: O, context: C, meta: SchemaPropertyMeta)
  => Promise<T>|T) & {
    toJSON? (): any;
  };

export interface SchemaProperty {
  type: (next?: SchemaFunction) => SchemaFunction;
  value?: SchemaFunction;
  resolve?: SchemaFunction;
}

export interface SchemaProperties {
  [key: string]: SchemaProperty;
}

export const typeMap = new WeakMap<any, any>();
export const nameMap: { [key: string]: Schema } = {};

export let id = 0;

export class Schema {
  meta: SchemaMeta;
  properties: SchemaProperties = {};

  constructor (schemaMeta: Partial<SchemaMeta>, schemaProperties: SchemaProperties) {
    this.meta = {
      name: `schema-${++id}`
    };

    this.addMetadata(schemaMeta);
    this.addProperties(schemaProperties);
  }

  addProperties (schemaProperties: SchemaProperties) {
    this.properties = Object.assign(this.properties, schemaProperties);

    return this;
  }

  addMetadata (schemaMeta: Partial<SchemaMeta>) {
    const oldName = this.meta.name;

    this.meta = Object.assign(this.meta, schemaMeta);

    delete nameMap[oldName];
    nameMap[this.meta.name] = this;

    return this;
  }

  async value<C> (obj: any, context: C) {
    const keys = Object.keys(this.properties);
    const results = await Promise.all(keys.map(async name => {
      const { type, value } = this.properties[name];
      const schemaFn = type(value);

      return schemaFn(obj[name], obj, context, {
        key: name
      });
    }));
    
    return results.reduce((data, res, index) => {
      const key = keys[index];

      if (res !== undefined) {
        data[key] = res;
      }

      return data;
    }, {});
  }
}

export function setSchema (schema: Schema, target: any) {
  typeMap.set(target !== null ? target : schema, schema);

  return schema;
}

export function getSchema (target: any): Schema|null {
  if (target instanceof Schema) {
    return target;
  }

  if (typeof target === 'string') {
    return nameMap[target] || null;
  }

  if (!target) {
    return null;
  }

  let p = target;

  do {
    const schema = typeMap.get(p);

    if (schema !== undefined) {
      return schema;
    }

    p = p.prototype;
  } while (!!p);

  return null;
}
