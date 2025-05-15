import { Request, Response } from "express";
import pool from "../config/db";

/** ✅ GET ALL TICKETS (with seats) */
export const getAllTickets = async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT 
        t.id AS ticket_id,
        t.user_id,
        t.movie_title,
        t.show_time,
        t.price,
        GROUP_CONCAT(s.seat_label ORDER BY s.seat_label) AS seats
      FROM tickets t
      JOIN ticket_seats ts ON t.id = ts.ticket_id
      JOIN seats s ON ts.seat_id = s.seat_id
      GROUP BY t.id
    `);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch all tickets" });
  }
};

/** ✅ GET TICKETS BY USER ID */
export const getTicketsByUser = async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const [rows]: any = await pool.execute(
      `
      SELECT 
        t.id AS ticket_id,
        t.user_id,
        t.movie_title,
        t.show_time,
        t.price,
        GROUP_CONCAT(s.seat_label ORDER BY s.seat_label) AS seats
      FROM tickets t
      JOIN ticket_seats ts ON t.id = ts.ticket_id
      JOIN seats s ON ts.seat_id = s.seat_id
      WHERE t.user_id = ?
      GROUP BY t.id
    `,
      [userId]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch user's tickets" });
  }
};

/** ✅ CREATE TICKET (with multiple seats) */
export const createTickets = async (req: Request, res: Response) => {
  const { user_id, movie_title, show_time, seats, price } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    const [result]: any = await conn.execute(
      "INSERT INTO tickets (user_id, movie_title, show_time, price) VALUES (?, ?, ?, ?)",
      [user_id, movie_title, show_time, price]
    );

    const ticketId = result.insertId;

    for (const seat_label of seats) {
      const [seatRows]: any = await conn.execute(
        "SELECT seat_id FROM seats WHERE seat_label = ?",
        [seat_label]
      );

      if (seatRows.length === 0) continue;

      const seat_id = seatRows[0].seat_id;

      await conn.execute(
        "INSERT INTO ticket_seats (ticket_id, seat_id) VALUES (?, ?)",
        [ticketId, seat_id]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({ message: "Ticket created successfully" });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ error: "Failed to create ticket" });
  }
};

/** ✅ UPDATE TICKET */
export const updateTicket = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { movie_title, show_time, price, seats } = req.body;

  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    await conn.execute(
      "UPDATE tickets SET movie_title = ?, show_time = ?, price = ? WHERE id = ?",
      [movie_title, show_time, price, id]
    );

    // Hapus kursi lama
    await conn.execute("DELETE FROM ticket_seats WHERE ticket_id = ?", [id]);

    // Tambah kursi baru
    for (const seat_label of seats) {
      const [seatRows]: any = await conn.execute(
        "SELECT seat_id FROM seats WHERE seat_label = ?",
        [seat_label]
      );
      if (seatRows.length === 0) continue;

      const seat_id = seatRows[0].seat_id;

      await conn.execute(
        "INSERT INTO ticket_seats (ticket_id, seat_id) VALUES (?, ?)",
        [id, seat_id]
      );
    }

    await conn.commit();
    conn.release();

    res.json({ message: "Ticket updated successfully" });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error(err);
    res.status(500).json({ error: "Failed to update ticket" });
  }
};

/** ✅ DELETE TICKET */
export const deleteTicket = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await pool.execute("DELETE FROM tickets WHERE id = ?", [id]);
    res.json({ message: "Ticket deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
};

/** ✅ GET ALL SEATS */
export const getAllSeats = async (_req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute("SELECT seat_label FROM seats");
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to get seats" });
  }
};

/** ✅ GET BOOKED SEATS BY MOVIE & TIME */
export const getBookedSeatsByShowtime = async (req: Request, res: Response) => {
  const { title, show_time } = req.query;

  if (!title || !show_time) {
    res.status(400).json({ error: "Missing title or show_time" });
    return;
  }

  const [rows] = await pool.execute(
    `SELECT s.seat_label
     FROM tickets t
     JOIN ticket_seats ts ON t.id = ts.ticket_id
     JOIN seats s ON ts.seat_id = s.seat_id
     WHERE t.movie_title = ? AND t.show_time = ?`,
    [title, show_time]
  );

  res.json({ data: rows });
};
