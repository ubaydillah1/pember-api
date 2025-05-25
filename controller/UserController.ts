import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma";

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
  const { user_id, movie_title, show_time, seats, price } = req.body;

  try {
    const ticket = await prisma.ticket.create({
      data: {
        userId: user_id,
        movieTitle: movie_title,
        showTime: new Date(show_time),
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
    console.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
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
  const { title, show_time } = req.query;

  if (!title || !show_time) {
    res.status(400).json({ error: "Missing title or show_time" });
    return;
  }

  try {
    const hour = parseInt(String(show_time).split(":")[0]);
    const minute = parseInt(String(show_time).split(":")[1]);

    const seats = await prisma.ticketSeat.findMany({
      where: {
        ticket: {
          movieTitle: String(title),
          showTime: {
            gte: new Date(2000, 0, 1, hour, minute),
            lt: new Date(2000, 0, 1, hour, minute + 1),
          },
        },
      },
      include: {
        seat: true,
      },
    });

    res.json({ data: seats.map((s) => s.seat.seatLabel) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch booked seats" });
  }
};
