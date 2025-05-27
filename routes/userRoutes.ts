import express from "express";
import {
  createTickets,
  deleteTicket,
  getAllSeats,
  getAllTickets,
  getTicketsByUser,
  updateTicket,
  getBookedSeatsByShowtime,
  getAllBookedSeatsByTitleAndTime,
  uploadFeedback,
  getAllFeedback,
} from "../controller/UserController";
import upload from "../middleware/upload";

const router = express.Router();

router.get("/tickets", getAllTickets);
router.get("/users/:userId/tickets", getTicketsByUser);
router.post("/tickets", createTickets);
router.put("/tickets/:id", updateTicket);
router.delete("/tickets/:id", deleteTicket);
router.get("/seats", getAllSeats);
router.get("/tickets/booked", getBookedSeatsByShowtime);
router.get("/tickets/booked/strict", getAllBookedSeatsByTitleAndTime);

// feedback
router.post("/feedback", upload.single("image"), uploadFeedback);

router.get("/feedbacks", getAllFeedback);

export default router;
