import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('crm_records',{
  owner:text('owner').notNull(),id:text('id').notNull(),type:text('type').notNull(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),deleted:integer('deleted').notNull().default(0)
},table=>[primaryKey({columns:[table.owner,table.id]}),index('crm_owner_type').on(table.owner,table.type)]);
