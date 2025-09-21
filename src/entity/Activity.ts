import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { User } from "./User.js";
import { ActivityCategory } from "./ActivityCategory.js";
import { ActivityParticipation } from "./ActivityParticipation.js";

@Entity()
export class Activity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column("tinytext")
    title: string;

    @Column("text")
    description: string;

    @ManyToOne('User', 'activities')
    organizer: Relation<User>;
    
    @ManyToOne('ActivityCategory', 'activities')
    category: Relation<ActivityCategory>;

    @Column("tinytext")
    location: string;
    
    @Column("tinytext")
    startDate: string;

    @Column("tinytext")
    endDate: string;

    @Column("int", {nullable: true})
    maxParticipants: number;
    
    @Column("tinytext", {nullable: true})
    featuredImage: string;
    
    @Column("tinytext")
    status: string; // pending, approved, rejected, completed, deleted

    @Column("tinytext")
    createdAt: string;
    
    @Column("tinytext")
    updatedAt: string;

    @OneToMany('ActivityParticipation', 'activity')
    participants: Relation<ActivityParticipation>[];

}