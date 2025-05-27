import express, { Request, Response } from "express";
import userRouter from "./routes/userRoutes";
import cors from "cors";

const app = express();
app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.urlencoded());

app.use(userRouter);

app.get(/.*/, (req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});

app.listen(4000, () => {
  console.log("Server Running on http://localhost:4000");
});
