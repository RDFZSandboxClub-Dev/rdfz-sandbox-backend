import type { Request, Response } from "express";
import { Activity } from "../entity/Activity.js";
import { User } from "../entity/User.js";
import type { AppServerI, ModuleInfoI, Result } from "../types.js";
import { GenRes, ResponseType } from "../utils.js";
import { ActivityCategory } from "../entity/ActivityCategory.js";
import { ActivityParticipation } from "../entity/ActivityParticipation.js";

const getCurrentTimestamp = (): string => {
    return new Date().toISOString();
}

export const moduleInfo: ModuleInfoI = {
    moduleName: "Activities & Activity Categories",
    moduleVersion: "v0.0.1",
    moduleDescription: "活动&活动类别控制模块",
    moduleIdentifier: "activities",
    entryPoint: (app: AppServerI) => {

        const getUserActivitiesHandler = (req: Request, res: Response) => {
            // user can get himself's joined activities
            // admin can get any user's joined activities
            // authentication and unbanned required
            // get user id from url param
            // with pagination and sorting
            // sorting: get key from query param 'orderBy', default is 'joinedAt'
            // sort order from query param 'order', 'asc' or 'desc', default is 'desc'
            // pagination: page, limit
            // filtering: by category id and/or status
            const userId = parseInt(req.params.userId);
            if (isNaN(userId) || userId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
            }
            const payloadResult = app.getUserService().getJWTPayload(token!);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.id !== userId && requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                const orderBy = req.query.orderBy as string || 'joinedAt';
                const order = (req.query.order as string || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                if (page <= 0 || limit <= 0 || limit > 100) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                const offset = (page - 1) * limit;
                const validOrderBy = ['joinedAt', 'title', 'startTime', 'endTime', 'createdAt', 'updatedAt'];
                if (!validOrderBy.includes(orderBy)) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                const filters: any = {};
                if (req.query.categoryId) {
                    const categoryId = parseInt(req.query.categoryId as string);
                    if (isNaN(categoryId) || categoryId <= 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    filters.category = { id: categoryId };
                }
                if (req.query.status) {
                    const status = req.query.status as string;
                    const validStatus = ['pending', 'approved', 'rejected', 'completed', 'deleted'];
                    if (!validStatus.includes(status)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (requester.role !== 'admin' && (status === 'pending' || status === 'rejected' || status === 'deleted')) {
                        res.status(403).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    filters.status = status;
                }
                else {
                    if (requester.role !== 'admin') {
                        filters.status = ['approved', 'completed'];
                    }
                }
                if (orderBy === 'joinedAt') {
                    // special case: joinedAt is in ActivityParticipation table
                    // need to join the ActivityParticipation table to get the joinedAt field
                    // but we don't need to select it, just use it for ordering
                    // only show activities with status 'approved' or 'completed' to normal users
                    // admin can view all activities
                    // finally, we need to paginate the results
                    // pagination info: total count, current page, total pages
                    
                    app.getDatabase().getDataSource().getRepository(ActivityParticipation)
                        .createQueryBuilder('activityParticipation')
                        .leftJoinAndSelect('activityParticipation.activity', 'activity')
                        .where('activityParticipation.userId = :userId', { userId })
                        .andWhere(requester.role === 'admin' ? '1=1' : "activity.status IN ('approved', 'completed') or activity.organizerId = :userId", { userId })
                        .andWhere(filters)
                        .orderBy(`activityParticipation.${orderBy}`, order as ("ASC" | "DESC"))
                        .skip(offset)
                        .take(limit)
                        .getManyAndCount().then((result) => {
                            const activities = result[0].map(participation => participation.activity);
                            res.status(200).json(GenRes.success({ activities, pagination: { total: result[1], page, limit } }));
                        }).catch((error) => {
                            res.status(500).json(GenRes.error(error));
                        });
                }
                else {
                    // normal case: orderBy is in Activity table
                    app.getDatabase().getDataSource().getRepository(ActivityParticipation)
                        .createQueryBuilder('activityParticipation')
                        .leftJoinAndSelect('activityParticipation.activity', 'activity')
                        .where('activityParticipation.userId = :userId', { userId })
                        .andWhere(requester.role === 'admin' ? '1=1' : "activity.status IN ('approved', 'completed') or activity.organizerId = :userId", { userId })
                        .andWhere(filters)
                        .orderBy(`activity.${orderBy}`, order as ("ASC" | "DESC"))
                        .skip(offset)
                        .take(limit)
                        .getManyAndCount().then((result) => {
                            const activities = result[0].map(participation => participation.activity);
                            res.status(200).json(GenRes.success({ activities, pagination: { total: result[1], page, limit } }));
                        }).catch((error) => {
                            res.status(500).json(GenRes.error(error));
                        });
                }
            });
        }

        const getActivityCategoriesHandler = (req: Request, res: Response) => {
            // get all activity categories
            // authentication and unbanned required
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                app.getDatabase().query('ActivityCategory').then((categoriesResult) => {
                    if (!categoriesResult.success) {
                        res.status(500).json(GenRes.error(categoriesResult.message));
                        return;
                    }
                    res.status(200).json(GenRes.success({ categories: categoriesResult.data }));
                });
            });
        }

        const getAllActivitiesHandler = (req: Request, res: Response) => {
            // get all activities with pagination and sorting and filtering
            // authentication and unbanned required
            // filtering by category id and/or status and/or organizer id
            // only activities with status 'approved' or 'completed' can be viewed by normal users
            // admin can view all activities
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                const orderBy = req.query.orderBy as string || 'startDate';
                const order = (req.query.order as string || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
                const page = parseInt(req.query.page as string) || 1;
                const limit = parseInt(req.query.limit as string) || 10;
                if (page <= 0 || limit <= 0 || limit > app.getConfig().paginationMaxPageSize) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                const offset = (page - 1) * limit;
                const validOrderBy = ['title', 'startDate', 'endDate', 'createdAt', 'updatedAt'];
                if (!validOrderBy.includes(orderBy)) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                const filters: any = {};
                if (req.query.categoryId) {
                    const categoryId = parseInt(req.query.categoryId as string);
                    if (isNaN(categoryId) || categoryId <= 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    filters.category = { id: categoryId };
                }
                if (req.query.status) {
                    const status = req.query.status as string;
                    const validStatus = ['pending', 'approved', 'rejected', 'completed', 'deleted'];
                    if (!validStatus.includes(status)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (requester.role !== 'admin' && (status === 'pending' || status === 'rejected' || status === 'deleted')) {
                        res.status(403).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    filters.status = status;
                }
                else {
                    if (requester.role !== 'admin') {
                        filters.status = ['approved', 'completed'];
                    }
                }
                if (req.query.organizerId) {
                    const organizerId = parseInt(req.query.organizerId as string);
                    if (isNaN(organizerId) || organizerId <= 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    filters.organizer = { id: organizerId };
                }
                app.getDatabase().getDataSource().getRepository(Activity)
                    .createQueryBuilder('activity')
                    .leftJoinAndSelect('activity.category', 'category')
                    .where(filters)
                    .orderBy(`activity.${orderBy}`, order as ("ASC" | "DESC"))
                    .skip(offset)
                    .take(limit)
                    .getManyAndCount().then((result) => {
                        res.status(200).json(GenRes.success({ activities: result[0], pagination: { total: result[1], page, limit } }));
                    }).catch((error) => {
                        res.status(500).json(GenRes.error(error));
                    });
            });
        }

        const getActivityByIdHandler = (req: Request, res: Response) => {
            // get activity by id
            // authentication and unbanned required
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                app.getDatabase().query<Activity>(Activity, {
                    where: [{id: activityId}]
                }).then((activityResult) => {
                    if (!activityResult.success) {
                        res.status(500).json(GenRes.error(activityResult.message));
                        return;
                    }
                    if (activityResult.data.length === 0) {
                        res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                        return;
                    }
                    if (requester.role !== 'admin' && requester.id === activityResult.data[0].organizer.id && (activityResult.data[0].status === 'pending' || activityResult.data[0].status === 'rejected' || activityResult.data[0].status === 'deleted')) {
                        res.status(403).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                        return;
                    }
                    res.status(200).json(GenRes.success({ activity: activityResult.data[0] }));
                });
            });
        }

        const createActivityHandler = (req: Request, res: Response) => {
            // create a new activity
            // authentication and unbanned required
            // only 'user' and 'admin' can create activities
            // request body: title, description, categoryId, location, startDate, endDate, maxParticipants, featuredImage
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                let { title, description, categoryId, location, startDate, endDate, maxParticipants, featuredImage } = req.body;
                if (!title || !description || !categoryId || !location || !startDate || !endDate ) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (typeof title !== 'string' || typeof description !== 'string' || typeof location !== 'string' || typeof startDate !== 'string' || typeof endDate !== 'string' ) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (title.length > 255 || location.length > 255 || (featuredImage && featuredImage.length > 255)) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (description.length > 5000) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate)) || new Date(startDate) >= new Date(endDate)) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (!maxParticipants) {
                    maxParticipants = null;
                }
                if (!featuredImage) {
                    featuredImage = null;
                }
                const categoryIdNum = parseInt(categoryId);
                maxParticipants = parseInt(maxParticipants);
                if (isNaN(categoryIdNum) || categoryIdNum <= 0 || (maxParticipants <= 0 && !isNaN(maxParticipants))) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (!maxParticipants) {
                    maxParticipants = null;
                }
                app.getDatabase().query<ActivityCategory>(ActivityCategory, { where: [{ id: categoryIdNum }]}).then((categoryResult) => {
                    if (!categoryResult.success) {
                        res.status(500).json(GenRes.error(categoryResult.message));
                        return;
                    }
                    if (categoryResult.data.length === 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    const newActivity = new Activity();
                    newActivity.title = title;
                    newActivity.description = description;
                    newActivity.organizer = requester;
                    newActivity.category = categoryResult.data[0];
                    newActivity.location = location;
                    newActivity.startDate = startDate;
                    newActivity.endDate = endDate;
                    newActivity.maxParticipants = maxParticipants;
                    newActivity.featuredImage = featuredImage;
                    newActivity.status = 'pending';
                    const timestamp = getCurrentTimestamp();
                    newActivity.createdAt = timestamp;
                    newActivity.updatedAt = timestamp;
                    app.getDatabase().save<Activity>(Activity, newActivity).then((saveResult) => {
                        if (!saveResult.success) {
                            res.status(500).json(GenRes.error(saveResult.message));
                            return;
                        }
                        // join the organizer to the activity
                        app.getDatabase().getDataSource().createQueryBuilder()
                            .insert()
                            .into('ActivityParticipation')
                            .values({
                                user: requester,
                                activity: newActivity,
                                joinedAt: getCurrentTimestamp()
                            })
                            .execute().then(() => {
                                res.status(200).json(GenRes.success({ activity: newActivity }));
                                return;
                            }).catch((error) => {
                                res.status(500).json(GenRes.error(error));
                                return;
                            });
                    });
                });
            });
        }

        const createCategoryHandler = (req: Request, res: Response) => {
            // create a new activity category
            // only admin can create activity categories
            // request body: name, description
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                if (requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                let { name, description } = req.body;
                if (!name || !description) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (typeof name !== 'string' || typeof description !== 'string') {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (name.length > 255) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                if (description.length > 5000) {
                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                    return;
                }
                const newCategory = new ActivityCategory();
                newCategory.name = name;
                newCategory.description = description;
                app.getDatabase().save<ActivityCategory>(ActivityCategory, newCategory).then((saveResult) => {
                    if (!saveResult.success) {
                        res.status(500).json(GenRes.error(saveResult.message));
                        return;
                    }
                    res.status(200).json(GenRes.success({ category: newCategory }));
                });
            });
        }

        const updateActivityHandler = (req: Request, res: Response) => {
            // update an activity
            // only admin or the organizer can update an activity
            // if the activity is pending or rejected, only admin or the organizer can update it
            // if the activity is approved or completed, only admin can update it
            // request body: title, description, categoryId, location, startDate, endDate, maxParticipants, featuredImage, status
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                    if (!activityResult.success) {
                        res.status(500).json(GenRes.error(activityResult.message));
                        return;
                    }
                    if (activityResult.data.length === 0) {
                        res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                        return;
                    }
                    const activity = activityResult.data[0];
                    if (requester.role !== 'admin' && requester.id !== activity.organizer.id) {
                        res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                        return;
                    }
                    if (activity.status === 'approved' || activity.status === 'completed' || activity.status === 'deleted' ) {
                        if (requester.role !== 'admin') {
                            res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                            return;
                        }
                    }
                    let { title, description, categoryId, location, startDate, endDate, maxParticipants, featuredImage, status } = req.body;
                    if (title && (typeof title !== 'string' || title.length > 255)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (description && (typeof description !== 'string' || description.length > 5000)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (location && (typeof location !== 'string' || location.length > 255)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (startDate && (typeof startDate !== 'string' || isNaN(Date.parse(startDate)))) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (endDate && (typeof endDate !== 'string' || isNaN(Date.parse(endDate)))) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if ((maxParticipants && maxParticipants !== -1) && (isNaN(parseInt(maxParticipants)) || parseInt(maxParticipants) <= 0)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (maxParticipants === -1 || maxParticipants === null) {
                        maxParticipants = null;
                    }
                    if (featuredImage && (typeof featuredImage !== 'string' || featuredImage.length > 255)) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (categoryId) {
                        const categoryIdNum = parseInt(categoryId);
                        if (isNaN(categoryIdNum) || categoryIdNum <= 0) {
                            res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                            return;
                        }
                        app.getDatabase().query<ActivityCategory>(ActivityCategory, { where: [{ id: categoryIdNum }]}).then((categoryResult) => {
                            if (!categoryResult.success) {
                                res.status(500).json(GenRes.error(categoryResult.message));
                                return;
                            }
                            if (categoryResult.data.length === 0) {
                                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                                return;
                            }
                            activity.category = categoryResult.data[0];
                            // after all checks, update the activity
                            if (title) activity.title = title;
                            if (description) activity.description = description;
                            if (location) activity.location = location;
                            if (startDate) activity.startDate = startDate;
                            if (endDate) activity.endDate = endDate;
                            if (maxParticipants) activity.maxParticipants = parseInt(maxParticipants);
                            else if (maxParticipants === null) activity.maxParticipants = null;
                            if (featuredImage) activity.featuredImage = featuredImage;
                            if (status) {
                                const validStatus = ['pending', 'approved', 'rejected', 'completed', 'deleted'];
                                if (!validStatus.includes(status)) {
                                    res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                                    return;
                                }
                                if (requester.role !== 'admin') {
                                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                                    return;
                                }
                                activity.status = status;
                            }
                            else {
                                activity.status = 'pending'; 
                            }
                            activity.updatedAt = getCurrentTimestamp();
                            app.getDatabase().save<Activity>(Activity, activity).then((saveResult) => {
                                if (!saveResult.success) {
                                    res.status(500).json(GenRes.error(saveResult.message));
                                    return;
                                }
                                res.status(200).json(GenRes.success({ activity }));
                            });
                        });
                    }
                    else {
                        // after all checks, update the activity
                        if (title) activity.title = title;
                        if (description) activity.description = description;
                        if (location) activity.location = location;
                        if (startDate) activity.startDate = startDate;
                        if (endDate) activity.endDate = endDate;
                        if (maxParticipants) activity.maxParticipants = parseInt(maxParticipants);
                        else if (maxParticipants === null) activity.maxParticipants = null;
                        if (featuredImage) activity.featuredImage = featuredImage;
                        if (status) {
                            const validStatus = ['pending', 'approved', 'rejected', 'completed', 'deleted'];
                            if (!validStatus.includes(status)) {
                                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                                return;
                            }
                            if (requester.role !== 'admin') {
                                res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                                return;
                            }
                            activity.status = status;
                        }
                        else {
                            activity.status = 'pending'; 
                        }
                        activity.updatedAt = getCurrentTimestamp();
                        app.getDatabase().save<Activity>(Activity, activity).then((saveResult) => {
                            if (!saveResult.success) {
                                res.status(500).json(GenRes.error(saveResult.message));
                                return;
                            }
                            res.status(200).json(GenRes.success({ activity }));
                        });
                    }
                });
            });
        }

        const deleteActivityHandler = (req: Request, res: Response) => {
            // delete an activity
            // only admin or the organizer can delete an activity
            // deleting an activity will set its status to 'deleted'
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                    if (!activityResult.success) {
                        res.status(500).json(GenRes.error(activityResult.message));
                        return;
                    }
                    if (activityResult.data.length === 0) {
                        res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                        return;
                    }
                    const activity = activityResult.data[0];
                    if (requester.role !== 'admin' && requester.id !== activity.organizer.id) {
                        res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                        return;
                    }
                    if (activity.status === 'deleted') {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    activity.status = 'deleted';
                    activity.updatedAt = getCurrentTimestamp();
                    app.getDatabase().save<Activity>(Activity, activity).then((saveResult) => {
                        if (!saveResult.success) {
                            res.status(500).json(GenRes.error(saveResult.message));
                            return;
                        }
                        res.status(200).json(GenRes.success({}));
                    });
                });
            });
        }

        const joinActivityHandler = (req: Request, res: Response) => {
            // join an activity
            // authentication and unbanned required
            // only 'user' can join activities
            // cannot join if already joined
            // cannot join if the activity is not 'approved'
            // cannot join if the activity is full
            // if maxParticipants is null, then the activity has no limit on participants
            // 'admin' can join any activity without restrictions
            // 'admin' can join any user to any activity without restrictions
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                if (requester.role !== 'user' && requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                if (req.body.userId && requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                let joinAsUser = requester;
                if (req.body.userId && requester.role === 'admin') {
                    const userId = parseInt(req.body.userId);
                    if (isNaN(userId) || userId <= 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    app.getDatabase().query<User>(User, { where: [{ id: userId }] }).then((userResult) => {
                        if (!userResult.success) {
                            res.status(500).json(GenRes.error(userResult.message));
                            return;
                        }
                        if (userResult.data.length === 0) {
                            res.status(404).json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                            return;
                        }
                        joinAsUser = userResult.data[0];
                        if (joinAsUser.role === 'deleted') {
                            res.status(400).json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                            return;
                        }
                        app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                            if (!activityResult.success) {
                                res.status(500).json(GenRes.error(activityResult.message));
                                return;
                            }
                            if (activityResult.data.length === 0) {
                                res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                                return;
                            }
                            const activity = activityResult.data[0];
                            if (requester.role !== 'admin' && activity.status !== 'approved') {
                                res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                                return;
                            }
                            // check if already joined
                            app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ user: { id: joinAsUser.id }, activity: { id: activity.id } }] }).then((participationResult) => {
                                if (!participationResult.success) {
                                    res.status(500).json(GenRes.error(participationResult.message));
                                    return;
                                }
                                if (participationResult.data.length > 0) {
                                    res.status(400).json(GenRes.fail(ResponseType.ALREADY_JOINED));
                                    return;
                                }
                                // check if full
                                if (requester.role !== 'admin' && activity.maxParticipants) {
                                    app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ activity: { id: activity.id } }] }).then((countResult) => {
                                        if (!countResult.success) {
                                            res.status(500).json(GenRes.error(countResult.message));
                                            return;
                                        }
                                        if (countResult.data.length >= activity.maxParticipants) {
                                            res.status(400).json(GenRes.fail(ResponseType.ACTIVITY_FULL));
                                            return;
                                        }
                                        // join the activity
                                        const newParticipation = new ActivityParticipation();
                                        newParticipation.user = joinAsUser;
                                        newParticipation.activity = activity;
                                        newParticipation.joinedAt = getCurrentTimestamp();
                                        app.getDatabase().save<ActivityParticipation>('ActivityParticipation', newParticipation).then((saveResult) => {
                                            if (!saveResult.success) {
                                                res.status(500).json(GenRes.error(saveResult.message));
                                                return;
                                            }
                                            res.status(200).json(GenRes.success({}));
                                        });
                                    });
                                }
                                else {
                                    // join the activity
                                    const newParticipation = new ActivityParticipation();
                                    newParticipation.user = joinAsUser;
                                    newParticipation.activity = activity;
                                    newParticipation.joinedAt = getCurrentTimestamp();
                                    app.getDatabase().save<ActivityParticipation>('ActivityParticipation', newParticipation).then((saveResult) => {
                                        if (!saveResult.success) {
                                            res.status(500).json(GenRes.error(saveResult.message));
                                            return;
                                        }
                                        res.status(200).json(GenRes.success({}));
                                    });
                                }
                            });
                        });
                    });
                }
                else {
                    app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                        if (!activityResult.success) {
                            res.status(500).json(GenRes.error(activityResult.message));
                            return;
                        }
                        if (activityResult.data.length === 0) {
                            res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                            return;
                        }
                        const activity = activityResult.data[0];
                        if (requester.role !== 'admin' && activity.status !== 'approved') {
                            res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                            return;
                        }
                        // check if already joined
                        app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ user: { id: joinAsUser.id }, activity: { id: activity.id } }] }).then((participationResult) => {
                            if (!participationResult.success) {
                                res.status(500).json(GenRes.error(participationResult.message));
                                return;
                            }
                            if (participationResult.data.length > 0) {
                                res.status(400).json(GenRes.fail(ResponseType.ALREADY_JOINED));
                                return;
                            }
                            // check if full
                            if (requester.role !== 'admin' && activity.maxParticipants) {
                                app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ activity: { id: activity.id } }] }).then((countResult) => {
                                    if (!countResult.success) {
                                        res.status(500).json(GenRes.error(countResult.message));
                                        return;
                                    }
                                    if (countResult.data.length >= activity.maxParticipants) {
                                        res.status(400).json(GenRes.fail(ResponseType.ACTIVITY_FULL));
                                        return;
                                    }
                                    // join the activity
                                    const newParticipation = new ActivityParticipation();
                                    newParticipation.user = joinAsUser;
                                    newParticipation.activity = activity;
                                    newParticipation.joinedAt = getCurrentTimestamp();
                                    app.getDatabase().save<ActivityParticipation>('ActivityParticipation', newParticipation).then((saveResult) => {
                                        if (!saveResult.success) {
                                            res.status(500).json(GenRes.error(saveResult.message));
                                            return;
                                        }
                                        res.status(200).json(GenRes.success({}));
                                    });
                                });
                            }
                            else {
                                // join the activity
                                const newParticipation = new ActivityParticipation();
                                newParticipation.user = joinAsUser;
                                newParticipation.activity = activity;
                                newParticipation.joinedAt = getCurrentTimestamp();
                                app.getDatabase().save<ActivityParticipation>('ActivityParticipation', newParticipation).then((saveResult) => {
                                    if (!saveResult.success) {
                                        res.status(500).json(GenRes.error(saveResult.message));
                                        return;
                                    }
                                    res.status(200).json(GenRes.success({}));
                                });
                            }
                        });
                    });
                }
            });
        }

        const leaveActivityHandler = (req: Request, res: Response) => {
            // leave an activity
            // authentication and unbanned required
            // only 'user' can leave activities
            // cannot leave if not joined
            // 'admin' can remove any user from any activity
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const payloadResult = app.getUserService().getJWTPayload(token);
            if (!payloadResult.success) {
                res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                return;
            }
            const requesterId = payloadResult.data!.id;
            app.getDatabase().query<User>(User, { where: [{ id: requesterId }] }).then((result) => {
                if (!result.success) {
                    res.status(500).json(GenRes.error(result.message));
                    return;
                }
                const requester = result.data[0];
                if (requester.role === 'banned') {
                    res.status(403).json(GenRes.fail(ResponseType.USER_BANNED));
                    return;
                }
                if (requester.role === 'deleted') {
                    res.status(401).json(GenRes.fail(ResponseType.UNAUTHORIZED));
                    return;
                }
                if (requester.role !== 'user' && requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                if (req.body.userId && requester.role !== 'admin') {
                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                    return;
                }
                let leaveAsUser = requester;
                if (req.body.userId && requester.role === 'admin') {
                    const userId = parseInt(req.body.userId);
                    if (isNaN (userId) || userId <= 0) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    app.getDatabase().query<User>(User, { where: [{ id: userId }] }).then((userResult) => {
                        if (!userResult.success) {
                            res.status(500).json(GenRes.error(userResult.message));
                            return;
                        }
                        if (userResult.data.length === 0) {
                            res.status(404).json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                            return;
                        }
                        leaveAsUser = userResult.data[0];
                        if (leaveAsUser.role === 'deleted') {
                            res.status(400).json(GenRes.fail(ResponseType.USER_NOT_FOUND));
                            return;
                        }
                        app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                            if (!activityResult.success) {
                                res.status(500).json(GenRes.error(activityResult.message));
                                return;
                            }
                            if (activityResult.data.length === 0) {
                                res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                                return;
                            }
                            const activity = activityResult.data[0];
                            if (activity.status === 'deleted') {
                                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                                return;
                            }
                            if (activity.status === 'pending' || activity.status === 'rejected') {
                                if (requester.role !== 'admin') {
                                    res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                                    return;
                                }
                            }
                            if (activity.organizer.id === leaveAsUser.id) {
                                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                                return;
                            }
                            app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ user: { id: leaveAsUser.id }, activity: { id: activity.id } }] }).then((participationResult) => {
                                if (!participationResult.success) {
                                    res.status(500).json(GenRes.error(participationResult.message));
                                    return;
                                }
                                if (participationResult.data.length === 0) {
                                    res.status(400).json(GenRes.fail(ResponseType.NOT_IN_ACTIVITY));
                                    return;
                                }
                                const participation = participationResult.data[0];
                                app.getDatabase().remove<ActivityParticipation>('ActivityParticipation', participation).then((removeResult) => {
                                    if (!removeResult.success) {
                                        res.status(500).json(GenRes.error(removeResult.message));
                                        return;
                                    }
                                    res.status(200).json(GenRes.success({}));
                                });
                            });
                        });
                    });
                }
                app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                    if (!activityResult.success) {
                        res.status(500).json(GenRes.error(activityResult.message));
                        return;
                    }
                    if (activityResult.data.length === 0) {
                        res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                        return;
                    }
                    const activity = activityResult.data[0];
                    if (activity.status === 'deleted') {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    if (activity.status === 'pending' || activity.status === 'rejected') {
                        if (requester.role !== 'admin') {
                            res.status(403).json(GenRes.fail(ResponseType.FORBIDDEN));
                            return;
                        }
                    }
                    if (activity.organizer.id === leaveAsUser.id) {
                        res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                        return;
                    }
                    app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ user: { id: leaveAsUser.id }, activity: { id: activity.id } }] }).then((participationResult) => {
                        if (!participationResult.success) {
                            res.status(500).json(GenRes.error(participationResult.message));
                            return;
                        }
                        if (participationResult.data.length === 0) {
                            res.status(400).json(GenRes.fail(ResponseType.NOT_IN_ACTIVITY));
                            return;
                        }
                        const participation = participationResult.data[0];
                        app.getDatabase().remove<ActivityParticipation>('ActivityParticipation', participation).then((removeResult) => {
                            if (!removeResult.success) {
                                res.status(500).json(GenRes.error(removeResult.message));
                                return;
                            }
                            res.status(200).json(GenRes.success({}));
                        });
                    });
                });
            });
        }
        
        const getActivityParticipantsHandler = (req: Request, res: Response) => {
            // get participants of an activity
            // everyone can view participants
            // pagination supported
            const activityId = parseInt(req.params.activityId);
            if (isNaN(activityId) || activityId <= 0) {
                res.status(400).json(GenRes.fail(ResponseType.BAD_REQUEST));
                return;
            }
            let page = parseInt(req.query.page as string) || 1;
            let pageSize = parseInt(req.query.pageSize as string) || 10;
            if (page <= 0) page = 1;
            if (pageSize <= 0) pageSize = 10;
            if (pageSize > app.getConfig().paginationMaxPageSize) pageSize = app.getConfig().paginationMaxPageSize
            app.getDatabase().query<Activity>(Activity, { where: [{ id: activityId }]}).then((activityResult) => {
                if (!activityResult.success) {
                    res.status(500).json(GenRes.error(activityResult.message));
                    return;
                }
                if (activityResult.data.length === 0) {
                    res.status(404).json(GenRes.fail(ResponseType.ACTIVITY_NOT_FOUND));
                    return;
                }
                const activity = activityResult.data[0];
                app.getDatabase().query<ActivityParticipation>('ActivityParticipation', { where: [{ activity: { id: activity.id } }], relations: ['user'], skip: (page - 1) * pageSize, take: pageSize }).then((participationResult) => {
                    if (!participationResult.success) {
                        res.status(500).json(GenRes.error(participationResult.message));
                        return;
                    }
                    const participants = participationResult.data.map(p => {
                        return {
                            id: p.user.id,
                            username: p.user.username,
                            role: p.user.role,
                            joinedAt: p.joinedAt
                        }
                    });
                    res.status(200).json(GenRes.success({ participants, page, pageSize }));
                });
            });
        }

        app.getExpress().get('/api/activities', getAllActivitiesHandler);
        app.getExpress().post('/api/activities', createActivityHandler);
        app.getExpress().get('/api/activities/categories/all', getActivityCategoriesHandler);
        app.getExpress().post('/api/activities/categories/new', createCategoryHandler);
        app.getExpress().put('/api/activities/:activityId', updateActivityHandler);
        app.getExpress().delete('/api/activities/:activityId', deleteActivityHandler);
        app.getExpress().get('/api/activities/:activityId', getActivityByIdHandler);
        app.getExpress().get('/api/activities/:activityId/participants', getActivityParticipantsHandler);
        app.getExpress().post('/api/activities/:activityId/leave', leaveActivityHandler);
        app.getExpress().post('/api/activities/:activityId/join', joinActivityHandler);
        
        app.getExpress().get('/api/users/:userId/activities', getUserActivitiesHandler);
        
    }
};