import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";
import supabase from "../config/supabase";
import { v4 } from "uuid";

const prisma = new PrismaClient();

export const getAllTickets = async (_req: Request, res: Response) => {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        seats: { include: { seat: true } },
      },
    });

    const formatted = tickets.map((t) => ({
      ticket_id: t.id,
      user_id: t.userId,
      movie_title: t.movieTitle,
      show_time: t.showTime,
      price: t.price,
      seats: t.seats.map((s) => s.seat.seatLabel),
    }));

    res.json({ data: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch all tickets" });
  }
};

export const getTicketsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId },
      include: {
        seats: { include: { seat: true } },
      },
    });

    const formatted = tickets.map((t) => ({
      ticket_id: t.id,
      user_id: t.userId,
      movie_title: t.movieTitle,
      show_time: t.showTime,
      price: t.price,
      seats: t.seats.map((s) => s.seat.seatLabel),
    }));

    res.json({ data: formatted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user's tickets" });
  }
};

export const createTickets = async (req: Request, res: Response) => {
  console.log(req.body);
  const { user_id, movie_title, show_time, seats, price } = req.body;

  const now = new Date();
  const parts = show_time.split(":");
  const fullDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    parseInt(parts[0]),
    parseInt(parts[1])
  );

  try {
    const ticket = await prisma.ticket.create({
      data: {
        userId: user_id,
        movieTitle: movie_title,
        showTime: fullDate,
        price,
        seats: {
          create: await Promise.all(
            seats.map(async (label: string) => {
              const seat = await prisma.seat.findUnique({
                where: { seatLabel: label },
              });
              if (!seat) throw new Error(`Seat ${label} not found`);
              return { seatId: seat.id };
            })
          ),
        },
      },
    });

    res.status(201).json({ message: "Ticket created", ticket_id: ticket.id });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      error: "Failed to create ticketssssssss",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export const updateTicket = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { movie_title, show_time, price, seats } = req.body;

  try {
    await prisma.ticket.update({
      where: { id: Number(id) },
      data: {
        movieTitle: movie_title,
        showTime: new Date(show_time),
        price,
        seats: {
          deleteMany: {},
        },
      },
    });

    await prisma.ticketSeat.createMany({
      data: await Promise.all(
        seats.map(async (label: string) => {
          const seat = await prisma.seat.findUnique({
            where: { seatLabel: label },
          });
          if (!seat) throw new Error(`Seat ${label} not found`);
          return { ticketId: Number(id), seatId: seat.id };
        })
      ),
    });

    res.json({ message: "Ticket updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
};

export const deleteTicket = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.ticket.delete({
      where: { id: Number(id) },
    });
    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
};

export const getAllSeats = async (_req: Request, res: Response) => {
  try {
    const seats = await prisma.seat.findMany({ select: { seatLabel: true } });
    res.json({ data: seats });
  } catch (err) {
    res.status(500).json({ error: "Failed to get seats" });
  }
};

export const getBookedSeatsByShowtime = async (req: Request, res: Response) => {
  const { title, show_time, exclude } = req.query;

  if (!title || !show_time) {
    res.status(400).json({ error: "Missing title or show_time" });
    return;
  }

  try {
    const [hourStr, minuteStr] = String(show_time).split(":");
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);
    const excludeId = exclude ? parseInt(String(exclude)) : null;

    const seats = await prisma.$queryRawUnsafe(
      `
      SELECT s."seatLabel"
      FROM "Ticket" t
      JOIN "TicketSeat" ts ON t.id = ts."ticketId"
      JOIN "Seat" s ON ts."seatId" = s.id
      WHERE t."movieTitle" = $1
        AND EXTRACT(HOUR FROM t."showTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') = $2
        AND EXTRACT(MINUTE FROM t."showTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') = $3
        AND ($4::int IS NULL OR t.id != $4)
      `,
      title,
      hour,
      minute,
      excludeId
    );

    res.json({ data: seats });
  } catch (err) {
    console.error("🔥 ERROR fetching booked seats:", err);
    res.status(500).json({ error: "Failed to fetch booked seats" });
  }
};

export const getAllBookedSeatsByTitleAndTime = async (
  req: Request,
  res: Response
) => {
  const { title, show_time } = req.query;

  if (!title || !show_time) {
    res.status(400).json({ error: "Missing title or show_time" });
    return;
  }

  try {
    const [hourStr, minuteStr] = String(show_time).split(":");
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);

    const seats = await prisma.$queryRawUnsafe(
      `
      SELECT s."seatLabel"
      FROM "Ticket" t
      JOIN "TicketSeat" ts ON t.id = ts."ticketId"
      JOIN "Seat" s ON ts."seatId" = s.id
      WHERE t."movieTitle" = $1
        AND EXTRACT(HOUR FROM t."showTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') = $2
        AND EXTRACT(MINUTE FROM t."showTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta') = $3
      `,
      title,
      hour,
      minute
    );

    res.json({ data: seats });
  } catch (err) {
    console.error("🔥 ERROR fetching all booked seats:", err);
    res.status(500).json({ error: "Failed to fetch booked seats" });
  }
};

export const uploadFeedback = async (req: Request, res: Response) => {
  const userId = req.body?.userId;
  const title = req.body?.title;
  const desctiption = req.body?.desctiption;
  const location = req.body?.location;
  const rating = req.body?.rating;

  const file = req.file;

  if (!userId || !title || !desctiption || !location || !rating || !file) {
    res.status(400).json({
      message:
        "Form belum lengkap. Pastikan semua kolom dan gambar sudah diisi.",
      missing: {
        userId: !userId,
        title: !title,
        desctiption: !desctiption,
        location: !location,
        rating: !rating,
        image: !file,
      },
    });
    return;
  }

  if (!file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }

  try {
    const fileName = `${v4()}_${file.originalname}`;
    const { error: uploadError } = await supabase.storage
      .from("feedback-images")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      res.status(500).json({
        message: "Upload to Supabase failed",
        error: uploadError.message,
      });
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("feedback-images")
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    const feedback = await prisma.feedback.create({
      data: {
        userId,
        title,
        desctiption,
        location,
        rating,
        image: imageUrl,
      },
    });

    res.status(201).json({ message: "Feedback uploaded", feedback });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllFeedback = async (req: Request, res: Response) => {
  try {
    const data = await prisma.feedback.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    res.json({
      data,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: (error as Error).message });
  }
};
