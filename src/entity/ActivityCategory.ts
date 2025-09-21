import { Column, Entity, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { Activity } from "./Activity.js";

@Entity()
export class ActivityCategory {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column("tinytext")
    name: string;
    
    @Column("text")
    description: string;

    @OneToMany('Activity', 'category')
    activities: Relation<Activity>[];
}