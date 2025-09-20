import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, type Relation } from "typeorm";
import { User } from "./User.js";

@Entity()
export class PointRecord {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne('User', 'pointRecords')
    @JoinColumn()
    user: Relation<User>;

    @Column({ type: "int" })
    points: number;

    @Column({ type: "text" })
    description: string;

    @Column({ type: "varchar", length: 255, nullable: true })
    relatedEntityType: string; // activity, product, etc.

    @Column({ type: "int", nullable: true })
    relatedEntityId: number;

    @CreateDateColumn()
    createdAt: string;
}