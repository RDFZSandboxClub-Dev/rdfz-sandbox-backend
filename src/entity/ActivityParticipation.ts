import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, type Relation } from "typeorm";
import { User } from "./User.js";
import { Activity } from "./Activity.js";

@Entity()
export class ActivityParticipation {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne('User', 'joinedActivities')
    @JoinColumn()
    user: Relation<User>;

    @ManyToOne('Activity', 'participants')
    @JoinColumn()
    activity: Relation<Activity>;

    @Column("tinytext")
    joinedAt: string;
}