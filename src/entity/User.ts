import { Entity, PrimaryGeneratedColumn, Column, OneToMany, type Relation } from "typeorm"
import { PointRecord } from "./PointRecord.js";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column("tinytext")
    username: string;

    @Column("tinytext")
    email: string;

    @Column("tinytext")
    password: string;

    @Column("tinytext")
    grade: string;

    @Column("tinytext")
    className: string;

    @Column("tinytext")
    minecraftId: string;

    @Column("tinytext")
    salt: string;

    @Column("tinytext")
    role: string;

    @Column("tinyint")
    isVerified: boolean;

    @Column("tinytext")
    createdAt: string;
    
    @Column("tinytext")
    lastLoginAt: string;

    @Column("longtext")
    bio: string;

    @OneToMany('PointRecord', 'user')
    pointRecords: Relation<PointRecord>[];

    @Column("int")
    points: number;
}
